import { db } from './db';
import { addToSyncQueue } from './syncUtils';
import { v4 as uuidv4 } from 'uuid';
import { playSuccessBeep, playDuplicateWarningBeep, playErrorBeep } from './audioUtils';

/**
 * Valida si un microchip cumple estrictamente con el estándar ISO 11784/11785 de 15 dígitos numéricos.
 * @param {string} chip
 * @returns {boolean}
 */
export function isValidChipNumber(chip) {
  if (!chip) return false;
  const clean = String(chip).trim();
  return /^\d{15}$/.test(clean);
}

/**
 * Normaliza textos para comparaciones limpias sin acentos ni mayúsculas
 */
export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Crea una nueva sesión de Vaquería
 */
export async function createVaqueria({ farmId, name, date, observations = '' }) {
  const actualUserId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';
  const adminId = localStorage.getItem('ganadera_admin_id');
  const role = localStorage.getItem('ganadera_user_role');
  const effectiveUserId = ((role === 'obrero' || role === 'operador') && adminId) ? adminId : actualUserId;
  const now = new Date().toISOString();

  const newVaqueria = {
    id: uuidv4(),
    user_id: effectiveUserId,
    farm_id: farmId,
    name: name?.trim() || `Vaquería ${date || new Date().toLocaleDateString('es-ES')}`,
    date: date || new Date().toISOString().split('T')[0],
    status: 'En progreso',
    observations: observations?.trim() || null,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  await db.vaquerias.put(newVaqueria);
  await addToSyncQueue('vaquerias', 'INSERT', newVaqueria);
  return newVaqueria;
}

/**
 * Actualiza los metadatos de una Vaquería existente
 */
export async function updateVaqueria(id, fields) {
  const now = new Date().toISOString();
  const existing = await db.vaquerias.get(id);
  if (!existing) throw new Error('Vaquería no encontrada');

  const updated = {
    ...existing,
    ...fields,
    name: fields.name !== undefined ? fields.name.trim() : existing.name,
    observations: fields.observations !== undefined ? (fields.observations?.trim() || null) : existing.observations,
    updated_at: now
  };

  await db.vaquerias.put(updated);
  await addToSyncQueue('vaquerias', 'UPDATE', updated);
  return updated;
}

/**
 * Elimina lógicamente una Vaquería
 */
export async function deleteVaqueria(id) {
  const now = new Date().toISOString();
  const existing = await db.vaquerias.get(id);
  if (!existing) return;

  const deleted = {
    ...existing,
    deleted_at: now,
    updated_at: now
  };

  await db.vaquerias.put(deleted);
  await addToSyncQueue('vaquerias', 'PATCH', { id, deleted_at: now });
}

/**
 * Encuentra la vaquería inmediatamente anterior de la misma finca
 */
export function getPreviousVaqueria(currentVaqueria, allVaquerias = []) {
  if (!currentVaqueria || !currentVaqueria.farm_id) return null;

  const farmVaquerias = allVaquerias.filter(v => 
    v.farm_id === currentVaqueria.farm_id && 
    v.id !== currentVaqueria.id && 
    !v.deleted_at
  );

  if (farmVaquerias.length === 0) return null;

  // Ordenar por fecha descendente, luego por created_at descendente
  farmVaquerias.sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return dateComp;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  // Tomar la primera cuya fecha sea estrictamente anterior a la actual (o misma fecha pero creada antes)
  const prior = farmVaquerias.find(v => {
    const dateV = v.date || '';
    const currDate = currentVaqueria.date || '';
    if (dateV < currDate) return true;
    if (dateV === currDate) {
      return (v.created_at || '') < (currentVaqueria.created_at || '');
    }
    return false;
  });

  return prior || null;
}

/**
 * Calcula la comparación y KPIs de una Vaquería:
 * - Animales presentes y su clasificación (Esperado, Nuevo en Vaquería, No registrado en sistema).
 * - Animales faltantes y su clasificación (Faltante Activo, Faltante Inactivo Previo).
 * - KPIs consolidados.
 */
export function calculateVaqueriaAnalysis({
  currentVaqueria,
  presentRecords = [],
  previousVaqueria = null,
  previousRecords = [],
  farmAnimals = [],
  allAnimals = []
}) {
  // --- MODO INMUTABLE POR SNAPSHOT ---
  // Si la vaquería está Finalizada y posee snapshot_data guardado,
  // se devuelve la fotografía histórica congelada para asegurar inmutabilidad absoluta.
  if (currentVaqueria?.status === 'Finalizada' && currentVaqueria?.snapshot_data) {
    const snap = currentVaqueria.snapshot_data;
    return {
      isComparisonWithInventory: Boolean(snap.isComparisonWithInventory),
      previousVaqueria: snap.previousVaqueria || null,
      classifiedPresent: snap.classifiedPresent || [],
      missingAnimals: snap.missingAnimals || [],
      kpis: snap.kpis || {},
      isSnapshot: true,
      finalizedAt: snap.finalized_at || null
    };
  }

  const animalsById = new Map();
  allAnimals.forEach(a => {
    if (a && a.id) animalsById.set(a.id, a);
  });

  // 1. Determinar el REBAÑO ESPERADO (Línea base)
  // Regla acordada: Todos los animales de la finca que se encuentren ACTIVOS son esperados en la vaquería,
  // hayan faltado o no a vaquerías anteriores.
  // Los animales inactivos NO aparecen en la lista de faltantes ni en el rebaño esperado.
  // Solo se excluyen animales cuya fecha de creación sea estrictamente posterior a la fecha de la vaquería.
  const isComparisonWithInventory = !previousVaqueria || previousRecords.length === 0;
  const vaqDate = currentVaqueria?.date || '';

  const expectedAnimals = farmAnimals.filter(a => {
    if (a.deleted_at) return false;
    if (a.status !== 'Activo') return false;

    const animalCreatedAt = a.created_at || '';
    const animalCreatedDate = animalCreatedAt.slice(0, 10);

    // Si la fecha de creación del animal es posterior a la fecha de la vaquería, no había llegado aún
    if (vaqDate && animalCreatedDate && animalCreatedDate > vaqDate) {
      return false;
    }

    return true;
  });

  const expectedIdsSet = new Set(expectedAnimals.map(a => a.id));

  // 2. Procesar Animales PRESENTES en la vaquería actual
  const classifiedPresent = [];
  let newUnregisteredCount = 0;
  let newInVaqueriaCount = 0;
  let normalExpectedCount = 0;

  const presentAnimalIdsSet = new Set();
  const presentChipsSet = new Set();
  const presentNumbersSet = new Set();

  presentRecords.forEach(rec => {
    const animal = rec.animal_id ? animalsById.get(rec.animal_id) : null;
    if (animal?.id) presentAnimalIdsSet.add(animal.id);
    if (rec.chip_number) presentChipsSet.add(rec.chip_number);
    if (animal?.chip_number) presentChipsSet.add(animal.chip_number);
    if (rec.number) presentNumbersSet.add(rec.number);
    if (animal?.number) presentNumbersSet.add(animal.number);

    let classification = 'EXPECTED'; // Por defecto
    let badgeLabel = 'Esperado';
    let badgeColor = 'bg-neutral-100 text-neutral-700 border-neutral-200';

    const isFromOtherFarm = Boolean(animal && currentVaqueria?.farm_id && animal.farm_id && animal.farm_id !== currentVaqueria.farm_id);

    if (rec.is_unregistered || !animal) {
      classification = 'UNREGISTERED_IN_SYSTEM';
      badgeLabel = ''; // Sin texto de no registrado por solicitud de diseño
      badgeColor = '';
      newUnregisteredCount++;
    } else if (isFromOtherFarm) {
      classification = 'OTHER_FARM';
      badgeLabel = 'Otra finca';
      badgeColor = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      newInVaqueriaCount++;
    } else if (!expectedIdsSet.has(animal.id)) {
      classification = 'NEW_IN_VAQUERIA';
      badgeLabel = 'Nuevo';
      badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
      newInVaqueriaCount++;
    } else {
      classification = 'EXPECTED';
      badgeLabel = 'Esperado';
      badgeColor = 'bg-neutral-100 text-neutral-700 border-neutral-200';
      normalExpectedCount++;
    }

    classifiedPresent.push({
      record: rec,
      animal,
      classification,
      badgeLabel,
      badgeColor,
      displayName: animal?.name || rec.name || 'Sin nombre',
      displayNumber: animal?.number || rec.number || '---',
      displayChip: animal?.chip_number || rec.chip_number || '---',
      displaySex: animal?.sex || null,
      displayBreed: animal?.breed || null
    });
  });

  // Ordenar lista de presentes: Siempre de primero los nuevos no registrados
  classifiedPresent.sort((a, b) => {
    const aIsUnreg = a.classification === 'UNREGISTERED_IN_SYSTEM' ? 1 : 0;
    const bIsUnreg = b.classification === 'UNREGISTERED_IN_SYSTEM' ? 1 : 0;
    if (aIsUnreg !== bIsUnreg) {
      return bIsUnreg - aIsUnreg; // Nuevos no registrados de primero
    }
    const timeA = new Date(a.record?.created_at || 0).getTime();
    const timeB = new Date(b.record?.created_at || 0).getTime();
    return timeB - timeA;
  });

  // 3. Procesar Animales FALTANTES (esperados que NO estuvieron presentes)
  const missingAnimals = [];
  let missingActiveCount = 0;
  let missingInactiveCount = 0;

  expectedAnimals.forEach(expAnimal => {
    // Comprobar si estuvo presente por ID, chip o arete
    const wasPresent = 
      presentAnimalIdsSet.has(expAnimal.id) ||
      (expAnimal.chip_number && presentChipsSet.has(expAnimal.chip_number)) ||
      (expAnimal.number && presentNumbersSet.has(expAnimal.number));

    if (!wasPresent) {
      const isAlreadyInactive = expAnimal.status === 'Inactivo';
      if (isAlreadyInactive) {
        missingInactiveCount++;
      } else {
        missingActiveCount++;
      }

      missingAnimals.push({
        animal: expAnimal,
        isAlreadyInactive,
        status: expAnimal.status,
        inactivityReason: expAnimal.inactivity_reason || null,
        displayName: expAnimal.name || 'Sin nombre',
        displayNumber: expAnimal.number || '---',
        displayChip: expAnimal.chip_number || '---',
        displaySex: expAnimal.sex,
        displayBreed: expAnimal.breed || 'Sin raza',
        badgeLabel: isAlreadyInactive ? 'Inactivo previo' : 'Faltante Activo',
        badgeColor: isAlreadyInactive 
          ? 'bg-neutral-100 text-neutral-600 border-neutral-300' 
          : 'bg-amber-100 text-amber-800 border-amber-300 font-black'
      });
    }
  });

  const totalPresent = classifiedPresent.length;
  const totalExpected = expectedAnimals.length;
  const attendanceRate = totalExpected > 0 ? Math.round((normalExpectedCount / totalExpected) * 100) : 100;

  return {
    isComparisonWithInventory,
    previousVaqueria,
    classifiedPresent,
    missingAnimals,
    kpis: {
      totalPresent,
      totalExpected,
      totalNew: newUnregisteredCount + newInVaqueriaCount,
      newUnregisteredCount,
      newInVaqueriaCount,
      totalMissing: missingActiveCount + missingInactiveCount,
      missingActiveCount,
      missingInactiveCount,
      attendanceRate
    }
  };
}

/**
 * Agrega un animal a la Vaquería de forma rápida e inteligente.
 * Maneja validaciones de duplicidad, longitud de chip, sonido y retorno de estado.
 */
export async function addAnimalToVaqueria({
  vaqueriaId,
  farmId,
  code,
  identificationType = 'auto', // 'auto' | 'chip' | 'arete' | 'name'
  manualAnimal = null // Objeto opcional si fue seleccionado directamente
}) {
  const actualUserId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';
  const adminId = localStorage.getItem('ganadera_admin_id');
  const role = localStorage.getItem('ganadera_user_role');
  const effectiveUserId = ((role === 'obrero' || role === 'operador') && adminId) ? adminId : actualUserId;
  const cleanCode = (code || '').trim();

  let effectiveFarmId = farmId;
  if (!effectiveFarmId && vaqueriaId) {
    try {
      const v = await db.vaquerias.get(vaqueriaId);
      if (v?.farm_id) effectiveFarmId = v.farm_id;
    } catch {
      // ignore
    }
  }

  if (!cleanCode && !manualAnimal) {
    playErrorBeep();
    return {
      success: false,
      reason: 'EMPTY_INPUT',
      message: 'Debe ingresar un código o seleccionar un animal.'
    };
  }

  // 1. Obtener animales ya registrados en esta vaquería para evitar duplicados
  const existingPresent = await db.vaqueria_animals
    .where('vaqueria_id')
    .equals(vaqueriaId)
    .and(r => !r.deleted_at)
    .toArray();

  const presentAnimalIds = new Set(existingPresent.map(r => r.animal_id).filter(Boolean));
  const presentChips = new Set(existingPresent.map(r => r.chip_number).filter(Boolean));
  const presentNumbers = new Set(existingPresent.map(r => r.number).filter(Boolean));

  // 2. Si es tipo chip o ráfaga de 15 dígitos numéricos, validar longitud ISO
  const is15Digits = /^\d{15}$/.test(cleanCode);
  if (identificationType === 'chip' && !is15Digits) {
    playErrorBeep();
    return {
      success: false,
      reason: 'INVALID_CHIP_FORMAT',
      message: 'El microchip RFID debe tener exactamente 15 dígitos numéricos.'
    };
  }

  // 3. Buscar si el animal ya existe en la base de datos
  let targetAnimal = manualAnimal;
  if (!targetAnimal) {
    const allActiveAnimals = await db.animals.filter(a => !a.deleted_at).toArray();

    if (is15Digits || identificationType === 'chip') {
      targetAnimal = allActiveAnimals.find(a => a.chip_number && a.chip_number.trim() === cleanCode);
    } else if (identificationType === 'arete') {
      // Priorizar coincidencia en la misma finca
      const farmMatches = allActiveAnimals.filter(a => 
        a.farm_id === effectiveFarmId && 
        normalizeText(a.number) === normalizeText(cleanCode)
      );
      if (farmMatches.length > 0) {
        targetAnimal = farmMatches[0];
      } else {
        // Coincidencia global
        targetAnimal = allActiveAnimals.find(a => normalizeText(a.number) === normalizeText(cleanCode));
      }
    } else if (identificationType === 'name') {
      targetAnimal = allActiveAnimals.find(a => 
        a.farm_id === effectiveFarmId && 
        normalizeText(a.name) === normalizeText(cleanCode)
      ) || allActiveAnimals.find(a => normalizeText(a.name) === normalizeText(cleanCode));
    } else {
      // 'auto': primero intentar por chip de 15 dígitos
      if (is15Digits) {
        targetAnimal = allActiveAnimals.find(a => a.chip_number && a.chip_number.trim() === cleanCode);
      }
      // Segundo intentar por número de arete en la misma finca
      if (!targetAnimal && effectiveFarmId) {
        targetAnimal = allActiveAnimals.find(a => 
          a.farm_id === effectiveFarmId && 
          normalizeText(a.number) === normalizeText(cleanCode)
        );
      }
      // Tercero intentar por número de arete global
      if (!targetAnimal) {
        targetAnimal = allActiveAnimals.find(a => normalizeText(a.number) === normalizeText(cleanCode));
      }
      // Cuarto intentar por chip aunque no tenga 15 dígitos exactos
      if (!targetAnimal) {
        targetAnimal = allActiveAnimals.find(a => a.chip_number && a.chip_number.trim() === cleanCode);
      }
    }
  }

  // 4. Validar que el animal pertenezca a la finca de esta vaquería
  if (targetAnimal && effectiveFarmId && targetAnimal.farm_id !== effectiveFarmId) {
    playErrorBeep();
    let otherFarmName = '';
    if (targetAnimal.farm_id) {
      try {
        const otherFarm = await db.farms.get(targetAnimal.farm_id);
        if (otherFarm?.name) {
          otherFarmName = ` (pertenece a la finca "${otherFarm.name}")`;
        }
      } catch {
        // ignore
      }
    } else {
      otherFarmName = ' (no tiene finca asignada en inventario)';
    }

    const animalDesc = targetAnimal.number 
      ? `Arete #${targetAnimal.number}` 
      : (targetAnimal.chip_number ? `Chip ${targetAnimal.chip_number}` : (targetAnimal.name || 'El animal'));

    return {
      success: false,
      reason: 'ANIMAL_OTHER_FARM',
      message: `El animal ${animalDesc} no pertenece a esta finca${otherFarmName}.`
    };
  }

  // 5. Validar que el animal no esté inactivo
  if (targetAnimal && targetAnimal.status === 'Inactivo') {
    playErrorBeep();
    return {
      success: false,
      reason: 'ANIMAL_INACTIVE',
      message: `El animal ${targetAnimal.number ? `Arete #${targetAnimal.number}` : (targetAnimal.chip_number ? `Chip ${targetAnimal.chip_number}` : 'seleccionado')} está inactivo y no puede registrar asistencia.`
    };
  }

  // 6. Validar duplicidad
  let isDuplicate = false;
  let duplicateField = '';

  if (targetAnimal) {
    if (presentAnimalIds.has(targetAnimal.id)) {
      isDuplicate = true;
      duplicateField = `Animal Arete #${targetAnimal.number}`;
    } else if (targetAnimal.chip_number && presentChips.has(targetAnimal.chip_number)) {
      isDuplicate = true;
      duplicateField = `Chip ${targetAnimal.chip_number}`;
    } else if (targetAnimal.number && presentNumbers.has(targetAnimal.number)) {
      isDuplicate = true;
      duplicateField = `Arete #${targetAnimal.number}`;
    }
  } else {
    // Si no está en BD, comprobar contra los no registrados ya escaneados/ingresados
    if (identificationType === 'name') {
      const presentNames = new Set(
        existingPresent
          .map(r => (r.name || '').trim().toLowerCase())
          .filter(Boolean)
      );
      if (presentNames.has(cleanCode.toLowerCase())) {
        isDuplicate = true;
        duplicateField = `Nombre "${cleanCode}"`;
      }
    } else if (is15Digits || identificationType === 'chip') {
      if (presentChips.has(cleanCode)) {
        isDuplicate = true;
        duplicateField = `Chip ${cleanCode}`;
      }
    } else if (presentNumbers.has(cleanCode)) {
      isDuplicate = true;
      duplicateField = `Arete #${cleanCode}`;
    }
  }

  if (isDuplicate) {
    playDuplicateWarningBeep();
    return {
      success: false,
      reason: 'DUPLICATE',
      message: `${duplicateField} ya está registrado en esta vaquería.`
    };
  }

  // 5. Inserción del registro en `vaqueria_animals`
  let initialNumber = null;
  let initialChip = null;
  let initialName = null;

  if (targetAnimal) {
    initialNumber = targetAnimal.number || null;
    initialChip = targetAnimal.chip_number || null;
    initialName = targetAnimal.name || null;
  } else {
    // Animal nuevo no registrado en sistema: asignar al campo correcto
    if (identificationType === 'name') {
      initialName = cleanCode;
      initialNumber = null;
      initialChip = null;
    } else if (identificationType === 'chip' || is15Digits) {
      initialChip = cleanCode;
      initialNumber = null;
      initialName = null;
    } else {
      // 'arete' o 'auto' numérico
      initialNumber = cleanCode;
      initialChip = null;
      initialName = null;
    }
  }

  // Asegurar que identification_type sea estrictamente uno de los permitidos por Supabase ('chip', 'arete', 'name', 'manual')
  let finalIdentificationType = identificationType;
  if (!['chip', 'arete', 'name', 'manual'].includes(finalIdentificationType)) {
    if (is15Digits || initialChip) {
      finalIdentificationType = 'chip';
    } else if (manualAnimal) {
      finalIdentificationType = 'manual';
    } else if (initialName) {
      finalIdentificationType = 'name';
    } else {
      finalIdentificationType = 'arete';
    }
  }

  const now = new Date().toISOString();
  const newRecord = {
    id: uuidv4(),
    vaqueria_id: vaqueriaId,
    user_id: effectiveUserId,
    animal_id: targetAnimal ? targetAnimal.id : null,
    scanned_code: cleanCode,
    identification_type: finalIdentificationType,
    number: initialNumber,
    chip_number: initialChip,
    name: initialName,
    is_unregistered: !targetAnimal,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  await db.vaqueria_animals.put(newRecord);
  await addToSyncQueue('vaqueria_animals', 'INSERT', newRecord);

  // Éxito: reproducir sonido agradable de asistencia
  playSuccessBeep();

  return {
    success: true,
    record: newRecord,
    animal: targetAnimal,
    isUnregistered: !targetAnimal,
    message: targetAnimal 
      ? `Asistencia registrada: Arete #${targetAnimal.number}${targetAnimal.name ? ` (${targetAnimal.name})` : ''}` 
      : identificationType === 'name'
        ? `Registrado: "${cleanCode}"`
        : is15Digits
          ? `Registrado: Chip ${cleanCode}`
          : `Registrado: Arete #${cleanCode}`
  };
}

/**
 * Quita un animal de la lista de asistencia de la vaquería
 */
export async function removeAnimalFromVaqueria(vaqueriaAnimalId) {
  const now = new Date().toISOString();
  const existing = await db.vaqueria_animals.get(vaqueriaAnimalId);
  if (!existing) return;

  const updated = {
    ...existing,
    deleted_at: now,
    updated_at: now
  };

  await db.vaqueria_animals.put(updated);
  await addToSyncQueue('vaqueria_animals', 'PATCH', { id: vaqueriaAnimalId, deleted_at: now, updated_at: now });
}

/**
 * Inactiva un animal faltante con motivo
 */
export async function inactivateAnimalDirectly({ animalId, reason }) {
  const now = new Date().toISOString();
  const animal = await db.animals.get(animalId);
  if (!animal) throw new Error('Animal no encontrado');

  const actualUserId = localStorage.getItem('ganadera_user_id') || animal.user_id;
  const updatedAnimal = {
    ...animal,
    status: 'Inactivo',
    inactivity_reason: reason?.trim() || 'Inactivo por Vaquería',
    updated_by_user_id: actualUserId,
    updated_at: now
  };

  await db.animals.put(updatedAnimal);
  await addToSyncQueue('animals', 'PATCH', {
    id: animalId,
    status: 'Inactivo',
    inactivity_reason: updatedAnimal.inactivity_reason,
    updated_by_user_id: actualUserId,
    updated_at: now
  });

  return updatedAnimal;
}

/**
 * Completa y registra un animal que fue escaneado en vaquería pero no existía en el sistema
 */
export async function completeUnregisteredAnimal({
  vaqueriaAnimalId,
  animalData
}) {
  const actualUserId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';
  const adminId = localStorage.getItem('ganadera_admin_id');
  const role = localStorage.getItem('ganadera_user_role');
  const effectiveUserId = ((role === 'obrero' || role === 'operador') && adminId) ? adminId : actualUserId;
  const now = new Date().toISOString();
  const newAnimalId = uuidv4();

  const cleanNumber = (animalData.number || '').trim();
  const cleanChip = (animalData.chip_number || '').trim();

  const newAnimal = {
    id: newAnimalId,
    user_id: effectiveUserId,
    created_by_user_id: actualUserId,
    updated_by_user_id: actualUserId,
    farm_id: animalData.farm_id || null,
    potrero_id: animalData.potrero_id || null,
    owner_id: animalData.owner_id || null,
    number: cleanNumber,
    chip_number: cleanChip || null,
    name: animalData.name?.trim() || null,
    sex: animalData.sex || 'Hembra',
    birth_date: animalData.birth_date || null,
    status: 'Activo',
    color: animalData.color?.trim() || null,
    breed: animalData.breed || 'Sin raza',
    observations: animalData.observations?.trim() || null,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  // 1. Guardar en Dexie y encolar a Supabase
  await db.animals.put(newAnimal);
  await addToSyncQueue('animals', 'INSERT', newAnimal);

  // 2. Actualizar el registro en `vaqueria_animals` para vincularlo al nuevo animal
  const vaqAnimal = await db.vaqueria_animals.get(vaqueriaAnimalId);
  if (vaqAnimal) {
    const updatedVaqAnimal = {
      ...vaqAnimal,
      animal_id: newAnimalId,
      number: newAnimal.number || null,
      chip_number: newAnimal.chip_number || null,
      name: newAnimal.name || null,
      identification_type: newAnimal.number
        ? (vaqAnimal.identification_type === 'chip' ? 'chip' : 'arete')
        : (newAnimal.chip_number ? 'chip' : (vaqAnimal.identification_type || 'arete')),
      is_unregistered: false,
      updated_at: now
    };
    await db.vaqueria_animals.put(updatedVaqAnimal);
    await addToSyncQueue('vaqueria_animals', 'UPDATE', updatedVaqAnimal);
  }

  return newAnimal;
}
