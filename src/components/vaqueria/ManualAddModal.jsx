import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, Cpu, User, Search, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { normalizeText } from '@/lib/vaqueriaUtils';
import { playErrorBeep } from '@/lib/audioUtils';

const DEFAULT_CHIP_PREFIX = '90023300833';

export default function ManualAddModal({
  isOpen,
  onClose,
  farmId,
  vaqueriaId,
  onRegister
}) {
  const [activeTab, setActiveTab] = useState('arete'); // 'arete' | 'chip' | 'name'
  const [inputValue, setInputValue] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Consultar todos los animales activos de la finca y globales
  const allAnimals = useLiveQuery(() => db.animals.filter(a => !a.deleted_at).toArray()) || [];

  // Consultar dueños para resolver el nombre de propietario en recomendaciones
  const allOwners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];
  const ownersById = useMemo(() => {
    const map = new Map();
    allOwners.forEach(o => map.set(o.id, o.name));
    return map;
  }, [allOwners]);
  
  // Animales ya registrados en esta vaquería
  const existingPresent = useLiveQuery(
    () => db.vaqueria_animals.where('vaqueria_id').equals(vaqueriaId).and(r => !r.deleted_at).toArray(),
    [vaqueriaId]
  ) || [];

  const presentAnimalIds = useMemo(() => new Set(existingPresent.map(r => r.animal_id).filter(Boolean)), [existingPresent]);
  const presentChips = useMemo(() => new Set(existingPresent.map(r => r.chip_number).filter(Boolean)), [existingPresent]);
  const presentNumbers = useMemo(() => new Set(existingPresent.map(r => r.number).filter(Boolean)), [existingPresent]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'chip') {
        setInputValue(DEFAULT_CHIP_PREFIX);
      } else {
        setInputValue('');
      }
      setSelectedAnimal(null);
      setError('');
    }
  }, [isOpen, activeTab]);

  // Sugerencias de animales según la pestaña y el input (exclusivas de esta finca y máximo 10)
  const suggestions = useMemo(() => {
    const query = normalizeText(inputValue);
    if (!query) return [];

    return allAnimals.filter(animal => {
      // Regla: No sugerir animales inactivos
      if (animal.status === 'Inactivo') return false;

      // Regla: Solo sugerir animales de la finca actual
      if (farmId && animal.farm_id !== farmId) return false;

      if (activeTab === 'arete') {
        return normalizeText(animal.number).includes(query);
      }
      if (activeTab === 'chip') {
        return animal.chip_number && animal.chip_number.includes(query);
      }
      if (activeTab === 'name') {
        return normalizeText(animal.name).includes(query);
      }
      return false;
    })
    .sort((a, b) => {
      if (activeTab === 'arete') {
        const aExact = normalizeText(a.number) === query;
        const bExact = normalizeText(b.number) === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      if (activeTab === 'chip') {
        const aExact = a.chip_number === query;
        const bExact = b.chip_number === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      if (activeTab === 'name') {
        const aExact = normalizeText(a.name) === query;
        const bExact = normalizeText(b.name) === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      return 0;
    })
    .slice(0, 10); // Máximo 10 sugerencias priorizando coincidencias exactas
  }, [allAnimals, activeTab, inputValue, farmId]);

  if (!isOpen) return null;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'chip') {
      setInputValue(DEFAULT_CHIP_PREFIX);
    } else {
      setInputValue('');
    }
    setSelectedAnimal(null);
    setError('');
  };

  const handleSelectAnimal = (animal) => {
    if (animal?.status === 'Inactivo') {
      setError('Este animal está marcado como inactivo y no puede registrarse.');
      return;
    }
    setSelectedAnimal(animal);
    if (activeTab === 'arete') setInputValue(animal.number || '');
    if (activeTab === 'chip') setInputValue(animal.chip_number || DEFAULT_CHIP_PREFIX);
    if (activeTab === 'name') setInputValue(animal.name || '');
    setError('');
  };

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    const clean = inputValue.trim();
    if (!clean && !selectedAnimal) {
      setError('Por favor ingrese o seleccione un código.');
      return;
    }

    if (activeTab === 'chip' && clean === DEFAULT_CHIP_PREFIX && !selectedAnimal) {
      setError('Por favor complete los últimos 4 dígitos del microchip.');
      return;
    }

    let animalToRegister = selectedAnimal;

    // Si estamos en la pestaña arete y no se seleccionó previamente un animal de la lista:
    if (activeTab === 'arete' && !animalToRegister && clean) {
      const query = normalizeText(clean);
      const exactMatches = allAnimals.filter(a =>
        a.status !== 'Inactivo' &&
        (!farmId || a.farm_id === farmId) &&
        normalizeText(a.number) === query
      );

      if (exactMatches.length === 1) {
        // Si solo hay un animal con ese número, lo seleccionamos automáticamente
        animalToRegister = exactMatches[0];
      } else if (exactMatches.length >= 2) {
        // Si son 2 o más, no registrar a ciegas y exigir que el usuario seleccione 1
        playErrorBeep();
        setError(`Hay ${exactMatches.length} animales con el número #${clean}. Debe seleccionar 1 de la lista.`);
        return;
      }
    }

    // Si estamos en la pestaña nombre y no se seleccionó previamente un animal de la lista:
    if (activeTab === 'name' && !animalToRegister && clean) {
      const query = normalizeText(clean);
      const exactMatches = allAnimals.filter(a =>
        a.status !== 'Inactivo' &&
        (!farmId || a.farm_id === farmId) &&
        normalizeText(a.name) === query
      );

      if (exactMatches.length === 1) {
        // Si solo hay un animal con ese nombre, lo seleccionamos automáticamente
        animalToRegister = exactMatches[0];
      } else if (exactMatches.length >= 2) {
        // Si son 2 o más con el mismo nombre, avisar que debe seleccionar 1 de ellos
        playErrorBeep();
        setError(`Hay ${exactMatches.length} animales con el nombre "${clean}". Debe seleccionar 1 de la lista.`);
        return;
      }
    }

    // Si estamos en la pestaña chip y no se seleccionó previamente un animal de la lista:
    if (activeTab === 'chip' && !animalToRegister && clean) {
      let match = allAnimals.find(a =>
        a.status !== 'Inactivo' &&
        (!farmId || a.farm_id === farmId) &&
        a.chip_number && a.chip_number.trim() === clean
      );
      // Si el usuario ingresó solo 4 dígitos y no coincide exactamente, probar con el prefijo por defecto
      if (!match && clean.length === 4) {
        const fullCandidate = `${DEFAULT_CHIP_PREFIX}${clean}`;
        match = allAnimals.find(a =>
          a.status !== 'Inactivo' &&
          (!farmId || a.farm_id === farmId) &&
          a.chip_number && a.chip_number.trim() === fullCandidate
        );
      }
      if (match) {
        animalToRegister = match;
      }
    }

    if (animalToRegister && animalToRegister.status === 'Inactivo') {
      const desc = animalToRegister.number 
        ? `Arete #${animalToRegister.number}` 
        : (animalToRegister.name ? `"${animalToRegister.name}"` : 'El animal');
      setError(`El animal ${desc} está inactivo y no puede registrar asistencia.`);
      return;
    }

    // Validación de duplicidad en la lista actual
    if (animalToRegister) {
      if (presentAnimalIds.has(animalToRegister.id)) {
        const desc = animalToRegister.number 
          ? `Arete #${animalToRegister.number}` 
          : (animalToRegister.name ? `"${animalToRegister.name}"` : 'El animal');
        setError(`El animal ${desc} ya está registrado en este evento.`);
        return;
      }
    } else {
      if (activeTab === 'chip' && presentChips.has(clean)) {
        setError(`El microchip ${clean} ya está registrado en este evento.`);
        return;
      }
      // NOTA: Para 'arete' y 'name' manual no registrado NO se bloquea duplicidad,
      // permitiendo registrar animales con igual número o nombre.
    }

    // Validación de pertenencia a la finca si se ingresa un código que pertenece a otra finca
    if (!animalToRegister && farmId) {
      let otherFarmAnimal = null;
      if (activeTab === 'chip' || /^\d{15}$/.test(clean)) {
        otherFarmAnimal = allAnimals.find(a => a.chip_number && a.chip_number.trim() === clean && a.farm_id && a.farm_id !== farmId);
      } else if (activeTab === 'arete') {
        const inThisFarm = allAnimals.some(a => a.farm_id === farmId && normalizeText(a.number) === normalizeText(clean));
        if (!inThisFarm) {
          otherFarmAnimal = allAnimals.find(a => normalizeText(a.number) === normalizeText(clean) && a.farm_id && a.farm_id !== farmId);
        }
      } else if (activeTab === 'name') {
        const inThisFarm = allAnimals.some(a => a.farm_id === farmId && normalizeText(a.name) === normalizeText(clean));
        if (!inThisFarm) {
          otherFarmAnimal = allAnimals.find(a => normalizeText(a.name) === normalizeText(clean) && a.farm_id && a.farm_id !== farmId);
        }
      }

      if (otherFarmAnimal) {
        playErrorBeep();
        let otherFarmName = '';
        if (otherFarmAnimal.farm_id) {
          try {
            const f = await db.farms.get(otherFarmAnimal.farm_id);
            if (f?.name) otherFarmName = ` (pertenece a la finca "${f.name}")`;
          } catch {
            // ignore
          }
        }
        const desc = otherFarmAnimal.number ? `Arete #${otherFarmAnimal.number}` : (otherFarmAnimal.chip_number ? `Chip ${otherFarmAnimal.chip_number}` : 'El animal');
        setError(`El animal ${desc} no pertenece a esta finca${otherFarmName}.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await onRegister({
        code: clean,
        identificationType: activeTab,
        manualAnimal: animalToRegister
      });

      if (result && !result.success) {
        setError(result.message || 'Error al registrar asistencia');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Error inesperado al agregar animal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isChipTab = activeTab === 'chip';

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1B4820] text-white flex items-center justify-center shadow-md shadow-[#1B4820]/20">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 leading-tight">
                  Asistencia Manual
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 md:p-6 overflow-y-auto space-y-5">
            {/* Tabs de Selección de Tipo */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-neutral-100 rounded-2xl">
              <button
                type="button"
                onClick={() => handleTabChange('arete')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'arete'
                    ? 'bg-white text-[#1B4820] shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Tag className="w-4 h-4" />
                Arete
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('chip')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'chip'
                    ? 'bg-white text-[#1B4820] shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Cpu className="w-4 h-4" />
                Chip
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('name')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'name'
                    ? 'bg-white text-[#1B4820] shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <User className="w-4 h-4" />
                Nombre
              </button>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Input Principal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider">
                  {activeTab === 'arete' && 'Número de Arete'}
                  {activeTab === 'chip' && 'Código de Microchip'}
                  {activeTab === 'name' && 'Nombre del Animal'}
                </label>

                {isChipTab && inputValue.trim().length > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    inputValue.trim().length === 15 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-neutral-100 text-neutral-700'
                  }`}>
                    {inputValue.trim().length}/15 dígitos
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  type={isChipTab ? 'tel' : 'text'}
                  value={inputValue}
                  onFocus={(e) => {
                    if (isChipTab && e.target.value === DEFAULT_CHIP_PREFIX) {
                      const len = e.target.value.length;
                      e.target.setSelectionRange(len, len);
                    }
                  }}
                  onChange={(e) => {
                    const val = isChipTab ? e.target.value.replace(/\D/g, '').slice(0, 15) : e.target.value;
                    setInputValue(val);
                    setSelectedAnimal(null);
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={
                    activeTab === 'arete' ? 'Ej. 104 o A-25' :
                    activeTab === 'chip' ? `Ej. ${DEFAULT_CHIP_PREFIX}5230` :
                    'Ej. Mariposa, Relámpago...'
                  }
                  autoComplete="off"
                  className="w-full px-4 py-3 bg-neutral-50 border rounded-2xl text-sm font-bold text-neutral-800 placeholder-neutral-400 focus:bg-white focus:ring-2 border-neutral-200 focus:border-[#1B4820] focus:ring-[#1B4820]/15 outline-none transition-all"
                />
              </div>
            </div>

            {/* Animal Seleccionado o Coincidencia en Sistema */}
            {selectedAnimal && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                    ✓
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-emerald-950">
                        Arete #{selectedAnimal.number} {selectedAnimal.name ? `• ${selectedAnimal.name}` : ''}
                      </h4>
                      {selectedAnimal.sex === 'Hembra' ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-700 shrink-0" title="Hembra">
                          <FaVenus className="w-2.5 h-2.5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 shrink-0" title="Macho">
                          <FaMars className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 mt-0.5 flex-wrap">
                      <span>{selectedAnimal.chip_number ? `Chip: ${selectedAnimal.chip_number}` : 'Sin chip'}</span>
                      <span className="text-emerald-300">•</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Dueño: {ownersById.get(selectedAnimal.owner_id) || 'Sin dueño'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnimal(null);
                    setInputValue(activeTab === 'chip' ? DEFAULT_CHIP_PREFIX : '');
                  }}
                  className="p-1.5 text-emerald-700 hover:text-emerald-900 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sugerencias de búsqueda reactivas */}
            {!selectedAnimal && suggestions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Coincidencias en el sistema ({suggestions.length})
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {suggestions.map(animal => {
                    const isAlreadyInVaq = presentAnimalIds.has(animal.id);
                    const ownerName = animal.owner_id ? ownersById.get(animal.owner_id) : null;
                    const isFemale = animal.sex === 'Hembra';

                    return (
                      <button
                        key={animal.id}
                        type="button"
                        disabled={isAlreadyInVaq}
                        onClick={() => handleSelectAnimal(animal)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isAlreadyInVaq
                            ? 'bg-neutral-100 border-neutral-200 opacity-60 cursor-not-allowed'
                            : 'bg-white border-neutral-200 hover:border-[#1B4820] hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {activeTab === 'chip' ? (
                            <Cpu className="w-4 h-4 text-[#1B4820] shrink-0" />
                          ) : activeTab === 'name' ? (
                            <User className="w-4 h-4 text-[#1B4820] shrink-0" />
                          ) : (
                            <Tag className="w-4 h-4 text-[#1B4820] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-neutral-900">
                                #{animal.number}
                              </span>
                              {animal.name && (
                                <span className="text-xs font-bold text-neutral-600 truncate max-w-[120px]">
                                  ({animal.name})
                                </span>
                              )}
                              {/* Icono del Sexo */}
                              {isFemale ? (
                                <span 
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-700 shrink-0" 
                                  title="Hembra"
                                >
                                  <FaVenus className="w-2.5 h-2.5" />
                                </span>
                              ) : (
                                <span 
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 shrink-0" 
                                  title="Macho"
                                >
                                  <FaMars className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>

                            {/* Información secundaria: Chip y Dueño */}
                            <div className="flex items-center gap-2 text-[10px] font-medium text-neutral-500 mt-0.5 flex-wrap">
                              <span>{animal.chip_number ? `Chip: ${animal.chip_number}` : 'Sin chip'}</span>
                              <span className="text-neutral-300">•</span>
                              <span className="text-neutral-700 font-bold flex items-center gap-1 truncate max-w-[160px]">
                                <User className="w-3 h-3 text-neutral-400 shrink-0" />
                                <span>{ownerName || 'Sin dueño'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2">
                          {isAlreadyInVaq ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                              Ya en Evento
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#1B4820]">
                              Seleccionar
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Aviso si no hay coincidencia en sistema */}
            {!selectedAnimal && inputValue.trim().length > 0 && suggestions.length === 0 && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl">
                <p className="text-xs font-bold text-neutral-700">
                  El código <span className="font-black text-[#1B4820]">"{inputValue.trim()}"</span> no pertenece a ningún animal registrado.
                </p>
                <p className="text-[11px] font-medium text-neutral-500 mt-0.5">
                  Se registrará como <span className="font-bold text-rose-700">No Registrado en Sistema</span> para que puedas completar sus datos al finalizar.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-5 md:p-6 border-t border-neutral-100 bg-neutral-50/60 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !inputValue.trim() || (isChipTab && inputValue.trim() === DEFAULT_CHIP_PREFIX && !selectedAnimal)}
              className="flex-1 py-3 px-4 bg-[#1B4820] text-white rounded-2xl text-sm font-black shadow-lg shadow-[#1B4820]/25 hover:bg-[#143618] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
