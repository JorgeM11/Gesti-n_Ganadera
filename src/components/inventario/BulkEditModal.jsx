import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Pencil, 
  AlertTriangle, 
  Check, 
  MapPin, 
  Fence, 
  Calendar, 
  UserCheck, 
  Activity,
  Layers,
  Info
} from 'lucide-react';
import { db } from '@/lib/db';
import { addToSyncQueue } from '@/lib/syncUtils';

const INACTIVITY_REASONS = [
  'Muerte',
  'Venta',
  'Descarte',
  'Pérdida / Extravío',
  'Traslado a otra finca',
  'Otro motivo'
];

export default function BulkEditModal({
  isOpen,
  onClose,
  selectedAnimalIds = new Set(),
  farms = [],
  potreros = [],
  owners = [],
  onSuccess
}) {
  const selectedCount = selectedAnimalIds.size || (Array.isArray(selectedAnimalIds) ? selectedAnimalIds.length : 0);

  // Estados de activación de cada campo
  const [fieldsToEdit, setFieldsToEdit] = useState({
    farm: false,
    potrero: false,
    birthYear: false,
    owner: false,
    status: false,
  });

  // Valores seleccionados
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPotreroId, setSelectedPotreroId] = useState('');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Inactivo');
  const [inactivityReason, setInactivityReason] = useState('Muerte');
  const [customInactivityNotes, setCustomInactivityNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Generar lista de años (año actual hasta 30 años atrás)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 30; y--) {
      years.push(y);
    }
    return years;
  }, []);

  // Potreros filtrados según la finca elegida
  const availablePotreros = useMemo(() => {
    if (fieldsToEdit.farm && selectedFarmId) {
      return potreros.filter(p => p.farm_id === selectedFarmId);
    }
    return potreros;
  }, [potreros, fieldsToEdit.farm, selectedFarmId]);

  if (!isOpen || selectedCount === 0) return null;

  const toggleField = (fieldKey) => {
    setFieldsToEdit(prev => {
      const next = { ...prev, [fieldKey]: !prev[fieldKey] };
      // Si se desactiva finca, y potrero dependía de ella, mantener potreros disponibles
      if (fieldKey === 'farm' && !next.farm) {
        setSelectedFarmId('');
      }
      return next;
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError('');

    // Validar que al menos un campo esté seleccionado para editar
    const hasAnyField = Object.values(fieldsToEdit).some(Boolean);
    if (!hasAnyField) {
      setError('Debes activar al menos una casilla de campo para aplicar cambios masivos.');
      return;
    }

    if (fieldsToEdit.farm && !selectedFarmId) {
      setError('Activaste el cambio de finca pero no seleccionaste ninguna finca.');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const actualUserId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';
      const targetIds = Array.from(selectedAnimalIds);

      // Traer los animales seleccionados desde IndexedDB
      const targetAnimals = await db.animals.where('id').anyOf(targetIds).toArray();
      const updatedAnimals = [];

      for (const animal of targetAnimals) {
        if (!animal) continue;
        const updated = { ...animal };

        // 1. Finca
        if (fieldsToEdit.farm) {
          updated.farm_id = selectedFarmId || null;
          // Regla: si se selecciona nueva finca y NO se selecciona nuevo potrero, quedan sin potrero asignado
          if (!fieldsToEdit.potrero) {
            updated.potrero_id = null;
          }
        }

        // 2. Potrero
        if (fieldsToEdit.potrero) {
          updated.potrero_id = selectedPotreroId || null;
        }

        // 3. Edad (Año de nacimiento -> se almacena como 1ro de enero del año seleccionado)
        if (fieldsToEdit.birthYear) {
          updated.birth_date = `${selectedYear}-01-01`;
        }

        // 4. Dueño
        if (fieldsToEdit.owner) {
          updated.owner_id = selectedOwnerId || null;
        }

        // 5. Estado (Status)
        if (fieldsToEdit.status) {
          updated.status = selectedStatus;
          if (selectedStatus === 'Inactivo') {
            const fullReason = customInactivityNotes.trim()
              ? `${inactivityReason}: ${customInactivityNotes.trim()}`
              : inactivityReason;
            updated.inactivity_reason = fullReason;
            updated.inactivated_at = now;
          } else {
            updated.inactivity_reason = null;
            updated.inactivated_at = null;
          }
        }

        updated.updated_by_user_id = actualUserId;
        updated.updated_at = now;

        updatedAnimals.push(updated);
      }

      // Guardar en bloque en Dexie (100% offline-first)
      await db.animals.bulkPut(updatedAnimals);

      // Encolar para sincronización con Supabase
      for (const updated of updatedAnimals) {
        await addToSyncQueue('animals', 'UPDATE', updated);
      }

      if (onSuccess) {
        onSuccess(updatedAnimals.length);
      }
      onClose();
    } catch (err) {
      console.error('Error al ejecutar edición masiva:', err);
      setError(err.message || 'Error al guardar los cambios masivos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
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
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#1B4820] flex items-center justify-center shrink-0 shadow-xs border border-emerald-200">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-neutral-900 leading-tight">
                  Edición Masiva de Animales
                </h3>
                <p className="text-xs font-bold text-neutral-500 mt-0.5">
                  Modificando <span className="text-[#1B4820] font-black">{selectedCount}</span> {selectedCount === 1 ? 'animal seleccionado' : 'animales seleccionados'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded-xl transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-sm">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-neutral-600">
              <Info className="w-4 h-4 text-[#1B4820] shrink-0 mt-0.5" />
              <span>
                Activa la casilla de cada dato que deseas modificar en lote. Los campos que no marques mantendrán el valor actual de cada animal.
              </span>
            </div>

            {/* 1. FINCA */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              fieldsToEdit.farm ? 'bg-emerald-50/20 border-emerald-300 shadow-xs' : 'bg-white border-neutral-200'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldsToEdit.farm}
                    onChange={() => toggleField('farm')}
                    className="w-4 h-4 rounded text-[#1B4820] focus:ring-[#1B4820] accent-[#1B4820] cursor-pointer"
                  />
                  <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#1B4820]" />
                    Modificar Finca
                  </span>
                </label>
                {fieldsToEdit.farm && (
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Activo
                  </span>
                )}
              </div>

              {fieldsToEdit.farm && (
                <div className="mt-3 space-y-2">
                  <select
                    value={selectedFarmId}
                    onChange={(e) => {
                      setSelectedFarmId(e.target.value);
                      setSelectedPotreroId('');
                    }}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#1B4820] shadow-xs cursor-pointer"
                  >
                    <option value="">Selecciona la nueva finca...</option>
                    {farms.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>

                  <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl p-2.5">
                    <strong>Nota:</strong> Si seleccionas una nueva finca y no especificas un potrero abajo, los animales quedarán sin potrero asignado.
                  </p>
                </div>
              )}
            </div>

            {/* 2. POTRERO */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              fieldsToEdit.potrero ? 'bg-emerald-50/20 border-emerald-300 shadow-xs' : 'bg-white border-neutral-200'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldsToEdit.potrero}
                    onChange={() => toggleField('potrero')}
                    className="w-4 h-4 rounded text-[#1B4820] focus:ring-[#1B4820] accent-[#1B4820] cursor-pointer"
                  />
                  <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                    <Fence className="w-3.5 h-3.5 text-[#1B4820]" />
                    Modificar Potrero
                  </span>
                </label>
                {fieldsToEdit.potrero && (
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Activo
                  </span>
                )}
              </div>

              {fieldsToEdit.potrero && (
                <div className="mt-3">
                  <select
                    value={selectedPotreroId}
                    onChange={(e) => setSelectedPotreroId(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#1B4820] shadow-xs cursor-pointer"
                  >
                    <option value="">Sin potrero asignado</option>
                    {availablePotreros.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {!fieldsToEdit.farm && p.farm_id ? `(${farms.find(f => f.id === p.farm_id)?.name || 'Finca'})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 3. EDAD (AÑO DE NACIMIENTO) */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              fieldsToEdit.birthYear ? 'bg-emerald-50/20 border-emerald-300 shadow-xs' : 'bg-white border-neutral-200'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldsToEdit.birthYear}
                    onChange={() => toggleField('birthYear')}
                    className="w-4 h-4 rounded text-[#1B4820] focus:ring-[#1B4820] accent-[#1B4820] cursor-pointer"
                  />
                  <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1B4820]" />
                    Modificar Edad (Año de Nacimiento)
                  </span>
                </label>
                {fieldsToEdit.birthYear && (
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Activo
                  </span>
                )}
              </div>

              {fieldsToEdit.birthYear && (
                <div className="mt-3 space-y-2">
                  <label className="block text-[11px] font-bold text-neutral-600">
                    Selecciona el Año de Nacimiento:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#1B4820] shadow-xs cursor-pointer"
                  >
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>Año {yr}</option>
                    ))}
                  </select>
                  <p className="text-[11px] font-medium text-neutral-500">
                    * En el sistema se registrará automáticamente como <strong>01 de enero de {selectedYear} (01/01/{selectedYear})</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* 4. DUEÑO */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              fieldsToEdit.owner ? 'bg-emerald-50/20 border-emerald-300 shadow-xs' : 'bg-white border-neutral-200'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldsToEdit.owner}
                    onChange={() => toggleField('owner')}
                    className="w-4 h-4 rounded text-[#1B4820] focus:ring-[#1B4820] accent-[#1B4820] cursor-pointer"
                  />
                  <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#1B4820]" />
                    Modificar Dueño
                  </span>
                </label>
                {fieldsToEdit.owner && (
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Activo
                  </span>
                )}
              </div>

              {fieldsToEdit.owner && (
                <div className="mt-3">
                  <select
                    value={selectedOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#1B4820] shadow-xs cursor-pointer"
                  >
                    <option value="">Sin dueño asignado</option>
                    {owners.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 5. STATUS / ESTADO */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              fieldsToEdit.status ? 'bg-emerald-50/20 border-emerald-300 shadow-xs' : 'bg-white border-neutral-200'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldsToEdit.status}
                    onChange={() => toggleField('status')}
                    className="w-4 h-4 rounded text-[#1B4820] focus:ring-[#1B4820] accent-[#1B4820] cursor-pointer"
                  />
                  <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#1B4820]" />
                    Modificar Estado (Status)
                  </span>
                </label>
                {fieldsToEdit.status && (
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Activo
                  </span>
                )}
              </div>

              {fieldsToEdit.status && (
                <div className="mt-3 space-y-3">
                  {/* Selector Activo / Inactivo */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('Inactivo')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        selectedStatus === 'Inactivo'
                          ? 'bg-neutral-800 text-white border-neutral-900 shadow-xs'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Inactivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('Activo')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        selectedStatus === 'Activo'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Activo
                    </button>
                  </div>

                  {/* Motivos de inactivación si se selecciona Inactivo */}
                  {selectedStatus === 'Inactivo' && (
                    <div className="space-y-2.5 pt-1">
                      <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                        Motivo de Inactivación:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {INACTIVITY_REASONS.map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setInactivityReason(r)}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                              inactivityReason === r
                                ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <span>{r}</span>
                            {inactivityReason === r && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                          </button>
                        ))}
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Detalles adicionales o notas del motivo (opcional)..."
                          value={customInactivityNotes}
                          onChange={(e) => setCustomInactivityNotes(e.target.value)}
                          className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-800 focus:outline-none focus:border-[#1B4820]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer de Acciones */}
            <div className="pt-2 sm:pt-4 border-t border-neutral-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !Object.values(fieldsToEdit).some(Boolean)}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-[#1B4820] hover:bg-[#143618] text-white transition-all cursor-pointer shadow-md shadow-[#1B4820]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4 stroke-[2.5]" />
                    <span>Guardar en {selectedCount} {selectedCount === 1 ? 'Animal' : 'Animales'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
