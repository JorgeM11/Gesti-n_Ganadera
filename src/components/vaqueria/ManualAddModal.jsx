import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, Cpu, User, Search, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { normalizeText, isValidChipNumber } from '@/lib/vaqueriaUtils';

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
      setInputValue('');
      setSelectedAnimal(null);
      setError('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, activeTab]);

  // Sugerencias de animales según la pestaña y el input (exclusivas de esta finca y máximo 5)
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
    }).slice(0, 5); // Máximo 5 sugerencias
  }, [allAnimals, activeTab, inputValue, farmId]);

  if (!isOpen) return null;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setInputValue('');
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
    if (activeTab === 'chip') setInputValue(animal.chip_number || '');
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

    if (selectedAnimal && selectedAnimal.status === 'Inactivo') {
      setError(`El animal Arete #${selectedAnimal.number} está inactivo y no puede registrar asistencia.`);
      return;
    }

    // Validación de Chip (15 dígitos ISO)
    if (activeTab === 'chip') {
      if (!isValidChipNumber(clean)) {
        setError('El microchip RFID debe tener exactamente 15 dígitos numéricos.');
        return;
      }
    }

    // Validación de duplicidad en la lista actual
    if (selectedAnimal) {
      if (presentAnimalIds.has(selectedAnimal.id)) {
        setError(`El animal Arete #${selectedAnimal.number} ya está registrado en esta vaquería.`);
        return;
      }
    } else {
      if (activeTab === 'chip' && presentChips.has(clean)) {
        setError(`El microchip ${clean} ya está registrado en esta vaquería.`);
        return;
      }
      if (activeTab === 'arete' && presentNumbers.has(clean)) {
        setError(`El arete #${clean} ya está registrado en esta vaquería.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await onRegister({
        code: clean,
        identificationType: activeTab,
        manualAnimal: selectedAnimal
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
  const isChipValidLength = isChipTab ? isValidChipNumber(inputValue.trim()) : true;

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
                    isChipValidLength 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
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
                    activeTab === 'chip' ? 'Ej. 982000361284915' :
                    'Ej. Mariposa, Relámpago...'
                  }
                  autoComplete="off"
                  className={`w-full px-4 py-3 bg-neutral-50 border rounded-2xl text-sm font-bold text-neutral-800 placeholder-neutral-400 focus:bg-white focus:ring-2 outline-none transition-all ${
                    isChipTab && inputValue.trim().length > 0 && !isChipValidLength
                      ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/15'
                      : 'border-neutral-200 focus:border-[#1B4820] focus:ring-[#1B4820]/15'
                  }`}
                />
              </div>

              {isChipTab && !isChipValidLength && inputValue.trim().length > 0 && (
                <p className="text-[11px] font-bold text-amber-700 mt-1">
                  El estándar ganadero ISO exige exactamente 15 dígitos numéricos.
                </p>
              )}
            </div>

            {/* Animal Seleccionado o Coincidencia en Sistema */}
            {selectedAnimal && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-950">
                      Arete #{selectedAnimal.number} {selectedAnimal.name ? `• ${selectedAnimal.name}` : ''}
                    </h4>
                    <p className="text-[11px] font-bold text-emerald-700">
                      {selectedAnimal.chip_number ? `Chip: ${selectedAnimal.chip_number}` : 'Sin chip'} • {selectedAnimal.sex}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnimal(null);
                    setInputValue('');
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
                        <div className="flex items-center gap-2.5">
                          <Tag className="w-4 h-4 text-[#1B4820]" />
                          <div>
                            <span className="text-xs font-black text-neutral-900">
                              #{animal.number}
                            </span>
                            {animal.name && (
                              <span className="text-xs font-bold text-neutral-600 ml-1.5">
                                ({animal.name})
                              </span>
                            )}
                            <div className="text-[10px] font-medium text-neutral-400">
                              {animal.chip_number ? `Chip: ${animal.chip_number}` : 'Sin chip'} • {animal.breed || 'Mestizo'}
                            </div>
                          </div>
                        </div>

                        {isAlreadyInVaq ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                            Ya en Vaquería
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#1B4820]">
                            Seleccionar
                          </span>
                        )}
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
              disabled={isSubmitting || (isChipTab && !isChipValidLength)}
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
