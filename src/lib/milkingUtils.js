import { db } from './db';
import { addToSyncQueue } from './syncUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Registra un ordeño (mañana, tarde o único) para una vaca
 */
export async function createMilkingRecord({
  animal_id,
  farm_id = null,
  milking_date = new Date().toISOString().split('T')[0],
  shift = 'Mañana',
  liters,
  observations = ''
}) {
  const userId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';

  const parsedLiters = Number(liters);
  if (isNaN(parsedLiters) || parsedLiters < 0) {
    throw new Error('Los litros deben ser un número mayor o igual a 0');
  }

  const now = new Date().toISOString();
  const record = {
    id: uuidv4(),
    user_id: userId,
    animal_id,
    farm_id: farm_id || null,
    milking_date,
    shift,
    liters: parsedLiters,
    observations: observations?.trim() || null,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  await db.milking_records.put(record);
  await addToSyncQueue('milking_records', 'INSERT', record);
  return record;
}

/**
 * Obtiene los registros de ordeño de un animal específico
 */
export async function getAnimalMilkingRecords(animal_id) {
  if (!animal_id) return [];
  return db.milking_records
    .where('animal_id')
    .equals(animal_id)
    .and(r => !r.deleted_at)
    .reverse()
    .sortBy('milking_date');
}

/**
 * Calcula el resumen de producción de una vaca (total histórico, promedio diario, último ordeño)
 */
export async function getAnimalMilkingSummary(animal_id) {
  const records = await getAnimalMilkingRecords(animal_id);
  if (records.length === 0) {
    return {
      totalLiters: 0,
      dailyAverage: 0,
      daysCount: 0,
      lastMilking: null,
      todayLiters: 0
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const totalLiters = records.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);

  // Agrupar por fecha para calcular días reales de ordeño
  const byDate = {};
  for (const r of records) {
    byDate[r.milking_date] = (byDate[r.milking_date] || 0) + (Number(r.liters) || 0);
  }

  const daysCount = Object.keys(byDate).length;
  const dailyAverage = daysCount > 0 ? totalLiters / daysCount : 0;
  const todayLiters = byDate[todayStr] || 0;

  return {
    totalLiters: Number(totalLiters.toFixed(2)),
    dailyAverage: Number(dailyAverage.toFixed(2)),
    daysCount,
    lastMilking: records[0],
    todayLiters: Number(todayLiters.toFixed(2))
  };
}

/**
 * Obtiene el total de litros del día para toda la finca o todo el rebaño
 */
export async function getDailyFarmMilkingTotal(dateStr = new Date().toISOString().split('T')[0], farm_id = null) {
  let query = db.milking_records.where('milking_date').equals(dateStr).and(r => !r.deleted_at);

  if (farm_id) {
    query = query.and(r => r.farm_id === farm_id);
  }

  const records = await query.toArray();
  const totalLiters = records.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);

  return {
    date: dateStr,
    totalLiters: Number(totalLiters.toFixed(2)),
    recordsCount: records.length,
    animalsCount: new Set(records.map(r => r.animal_id)).size
  };
}

/**
 * Actualiza un registro de ordeño existente
 */
export async function updateMilkingRecord({
  id,
  milking_date,
  shift,
  liters,
  observations = ''
}) {
  if (!id) throw new Error('ID requerido para actualizar');
  const parsedLiters = Number(liters);
  if (isNaN(parsedLiters) || parsedLiters < 0) {
    throw new Error('Los litros deben ser un número mayor o igual a 0');
  }

  const existing = await db.milking_records.get(id);
  if (!existing) throw new Error('Registro de ordeño no encontrado');

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    milking_date: milking_date || existing.milking_date,
    shift: shift || existing.shift,
    liters: parsedLiters,
    observations: observations !== undefined ? (observations?.trim() || null) : existing.observations,
    updated_at: now
  };

  await db.transaction('rw', [db.milking_records, db.sync_queue], async () => {
    await db.milking_records.put(updated);
    await addToSyncQueue('milking_records', 'UPDATE', updated);
  });

  return updated;
}

/**
 * Eliminación lógica (soft delete) de un registro de ordeño
 */
export async function deleteMilkingRecord(id) {
  if (!id) return;
  const now = new Date().toISOString();
  await db.transaction('rw', [db.milking_records, db.sync_queue], async () => {
    await db.milking_records.update(id, { deleted_at: now, updated_at: now });
    await addToSyncQueue('milking_records', 'PATCH', { id, deleted_at: now });
  });
}

