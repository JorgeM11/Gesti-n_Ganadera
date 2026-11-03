import React, { useState, useMemo, useEffect } from 'react';
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
import CustomSelect from '@/components/ui/CustomSelect';

const INACTIVITY_REASONS = [
  'Muerte',
  'Venta',
  'Descarte',
  'Pérdida / Extravío'
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

  // Limpiar y resetear el formulario cada vez que se abra o cierre
  const resetForm = () => {
    setFieldsToEdit({
      farm: false,
      potrero: false,
      birthYear: false,
      owner: false,
      status: false,
    });
    setSelectedFarmId('');
    setSelectedPotreroId('');
    setSelectedYear(new Date().getFullYear());
    setSelectedOwnerId('');
    setSelectedStatus('Inactivo');
    setInactivityReason('Muerte');
    setCustomInactivityNotes('');
    setError('');
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

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

  // Opciones formateadas para CustomSelect
  const farmOptions = useMemo(() => [
    { value: '', label: 'Selecciona una finca...' },
    ...farms.map(f => ({
      value: f.id,
      label: `${f.name}${f.location ? ` (${f.location})` : ''}`
    }))
  ], [farms]);

  const potreroOptions = useMemo(() => [
    { value: '', label: 'Sin potrero asignado' },
    ...availablePotreros.map(p => {
      const farmName = farms.find(f => f.id === p.farm_id)?.name;
      return {
        value: p.id,
        label: farmName ? `${p.name} (Finca: ${farmName})` : p.name
      };
    })
  ], [availablePotreros, farms]);

  const yearOptions = useMemo(() => availableYears.map(yr => ({
    value: String(yr),
    label: `Año ${yr}`
  })), [availableYears]);

  const ownerOptions = useMemo(() => [
    { value: '', label: 'Sin dueño asignado' },
    ...owners.map(o => ({
      value: o.id,
      label: o.name
    }))
  ], [owners]);

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
      const targetIds = Array.from(selectedAnimalIds);

      // Traer los animales seleccionados desde IndexedDB
      const targetAnimals = await db.animals.where('id').anyOf(targetIds).toArray();
      const updatedAnimals = [];
      const syncPatches = [];
      const currentUserId = localStorage.getItem('ganadera_user_id');

      for (const animal of targetAnimals) {
        if (!animal) continue;
        const updated = { ...animal };
        const patchPayload = { id: updated.id, updated_at: now };

        if (currentUserId) {
          updated.updated_by_user_id = currentUserId;
          patchPayload.updated_by_user_id = currentUserId;
        }

        // 1. Finca
        if (fieldsToEdit.farm) {
          updated.farm_id = selectedFarmId || null;
          patchPayload.farm_id = selectedFarmId || null;
          // Regla: si se selecciona nueva finca y NO se selecciona nuevo potrero, quedan sin potrero asignado
          if (!fieldsToEdit.potrero) {
            updated.potrero_id = null;
            patchPayload.potrero_id = null;
          }
        }

        // 2. Potrero
        if (fieldsToEdit.potrero) {
          if (selectedPotreroId) {
            const pot = potreros.find(p => p.id === selectedPotreroId);
            updated.potrero_id = selectedPotreroId;
            patchPayload.potrero_id = selectedPotreroId;

            // Validación: Si se selecciona un potrero, los animales se pasan a la finca de ese potrero
            if (pot && pot.farm_id) {
              updated.farm_id = pot.farm_id;
              patchPayload.farm_id = pot.farm_id;
            }
          } else {
            updated.potrero_id = null;
            patchPayload.potrero_id = null;
          }
        }

        // 3. Edad (Año de nacimiento -> se almacena como 1ro de enero del año seleccionado)
        if (fieldsToEdit.birthYear) {
          const birthDate = `${selectedYear}-01-01`;
          updated.birth_date = birthDate;
          patchPayload.birth_date = birthDate;
        }

        // 4. Dueño
        if (fieldsToEdit.owner) {
          updated.owner_id = selectedOwnerId || null;
          patchPayload.owner_id = selectedOwnerId || null;
        }

        // 5. Estado (Status)
        if (fieldsToEdit.status) {
          updated.status = selectedStatus;
          patchPayload.status = selectedStatus;
          if (selectedStatus === 'Inactivo') {
            const fullReason = customInactivityNotes.trim()
              ? `${inactivityReason}: ${customInactivityNotes.trim()}`
              : inactivityReason;
            updated.inactivity_reason = fullReason;
            patchPayload.inactivity_reason = fullReason;
          } else {
            updated.inactivity_reason = null;
            patchPayload.inactivity_reason = null;
          }
        }

        // Limpieza de campos inexistentes en Supabase
        delete updated.inactivated_at;
        updated.updated_at = now;

        updatedAnimals.push(updated);
        syncPatches.push(patchPayload);
      }

      // Guardar en bloque en Dexie (100% offline-first)
      await db.animals.bulkPut(updatedAnimals);

      // Encolar patches limpios para sincronización con Supabase (HTTP PATCH)
      for (const patch of syncPatches) {
        await addToSyncQueue('animals', 'PATCH', patch);
      }

      resetForm();
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
      {/* 1. Contenedor principal: Actúa como el límite estricto de la pantalla real */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        
        {/* Backdrop: Ahora absolute para rellenar perfectamente el contenedor padre */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window: max-h-full obliga a usar el espacio que el padre le cede, solucionando el bug de vh */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl md:max-w-3xl bg-white rounded-3xl shadow-2xl z-10 flex flex-col max-h-full overflow-hidden"
        >
          {/* 1. Header (Fijo arriba, fuera del contenedor con scroll) */}
          <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#1B4820] flex items-center justify-center shrink-0 shadow-xs border border-emerald-200">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-neutral-900 leading-tight">
                  Edición Masiva
                </h3>
                <p className="text-xs text-neutral-500 font-medium">
                  Modificando <span className="font-black text-[#1B4820]">{selectedCount}</span> {selectedCount === 1 ? 'animal seleccionado' : 'animales seleccionados'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-neutral-200/60 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Cuerpo del modal / Lista de opciones (flex-1 overflow-y-auto para que solo scrollee esta seccion) */}
          <form 
            id="bulk-edit-form"
            onSubmit={handleSubmit} 
            className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4"
          >
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              

              {/* Grid Responsivo: 1 columna en móvil, 2 columnas equilibradas en desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* 1. FINCA */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  fieldsToEdit.farm ? 'bg-emerald-50/25 border-[#1B4820]/40 ring-1 ring-[#1B4820]/20 shadow-xs' : 'bg-neutral-50/60 border-neutral-200/80'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all shrink-0 ${
                        fieldsToEdit.farm ? 'bg-[#1B4820] border-[#1B4820]' : 'border-neutral-300 bg-white'
                      }`}>
                        {fieldsToEdit.farm && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={fieldsToEdit.farm}
                        onChange={() => toggleField('farm')}
                        className="sr-only"
                      />
                      <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#1B4820]" />
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
                      <CustomSelect
                        value={selectedFarmId}
                        onChange={(val) => {
                          setSelectedFarmId(val);
                          setSelectedPotreroId('');
                        }}
                        options={farmOptions}
                        placeholder="Selecciona la nueva finca..."
                        bgClass="bg-white"
                        searchable
                        searchPlaceholder="Buscar finca..."
                      />

                      
                    </div>
                  )}
                </div>

                {/* 2. POTRERO */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  fieldsToEdit.potrero ? 'bg-emerald-50/25 border-[#1B4820]/40 ring-1 ring-[#1B4820]/20 shadow-xs' : 'bg-neutral-50/60 border-neutral-200/80'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all shrink-0 ${
                        fieldsToEdit.potrero ? 'bg-[#1B4820] border-[#1B4820]' : 'border-neutral-300 bg-white'
                      }`}>
                        {fieldsToEdit.potrero && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={fieldsToEdit.potrero}
                        onChange={() => toggleField('potrero')}
                        className="sr-only"
                      />
                      <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <Fence className="w-4 h-4 text-[#1B4820]" />
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
                    <div className="mt-3 space-y-2">
                      <CustomSelect
                        value={selectedPotreroId}
                        onChange={(val) => {
                          setSelectedPotreroId(val);
                          if (val) {
                            const pot = potreros.find(p => p.id === val);
                            if (pot && pot.farm_id) {
                              setSelectedFarmId(pot.farm_id);
                            }
                          }
                        }}
                        options={potreroOptions}
                        placeholder={availablePotreros.length === 0 ? "Sin potreros disponibles" : "Selecciona potrero..."}
                        bgClass="bg-white"
                        searchable
                        searchPlaceholder="Buscar potrero..."
                      />
                    </div>
                  )}
                </div>

                {/* 3. EDAD (AÑO DE NACIMIENTO) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  fieldsToEdit.birthYear ? 'bg-emerald-50/25 border-[#1B4820]/40 ring-1 ring-[#1B4820]/20 shadow-xs' : 'bg-neutral-50/60 border-neutral-200/80'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all shrink-0 ${
                        fieldsToEdit.birthYear ? 'bg-[#1B4820] border-[#1B4820]' : 'border-neutral-300 bg-white'
                      }`}>
                        {fieldsToEdit.birthYear && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={fieldsToEdit.birthYear}
                        onChange={() => toggleField('birthYear')}
                        className="sr-only"
                      />
                      <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#1B4820]" />
                        Modificar Edad (Año)
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
                      
                      <CustomSelect
                        value={String(selectedYear)}
                        onChange={(val) => setSelectedYear(Number(val))}
                        options={yearOptions}
                        placeholder="Selecciona año..."
                        bgClass="bg-white"
                        searchable
                        searchPlaceholder="Buscar año..."
                      />
                     
                    </div>
                  )}
                </div>

                {/* 4. DUEÑO */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  fieldsToEdit.owner ? 'bg-emerald-50/25 border-[#1B4820]/40 ring-1 ring-[#1B4820]/20 shadow-xs' : 'bg-neutral-50/60 border-neutral-200/80'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all shrink-0 ${
                        fieldsToEdit.owner ? 'bg-[#1B4820] border-[#1B4820]' : 'border-neutral-300 bg-white'
                      }`}>
                        {fieldsToEdit.owner && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={fieldsToEdit.owner}
                        onChange={() => toggleField('owner')}
                        className="sr-only"
                      />
                      <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[#1B4820]" />
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
                      <CustomSelect
                        value={selectedOwnerId}
                        onChange={(val) => setSelectedOwnerId(val)}
                        options={ownerOptions}
                        placeholder="Selecciona dueño..."
                        bgClass="bg-white"
                        searchable
                        searchPlaceholder="Buscar dueño..."
                      />
                    </div>
                  )}
                </div>

                {/* 5. STATUS / ESTADO (Abarca ambas columnas en desktop para amplitud y comodidad) */}
                <div className={`md:col-span-2 p-4 rounded-2xl border transition-all ${
                  fieldsToEdit.status ? 'bg-emerald-50/25 border-[#1B4820]/40 ring-1 ring-[#1B4820]/20 shadow-xs' : 'bg-neutral-50/60 border-neutral-200/80'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all shrink-0 ${
                        fieldsToEdit.status ? 'bg-[#1B4820] border-[#1B4820]' : 'border-neutral-300 bg-white'
                      }`}>
                        {fieldsToEdit.status && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={fieldsToEdit.status}
                        onChange={() => toggleField('status')}
                        className="sr-only"
                      />
                      <span className="font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-[#1B4820]" />
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
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStatus('Inactivo')}
                          className={`py-3 px-4 rounded-2xl border-2 font-black text-xs sm:text-sm transition-all cursor-pointer ${
                            selectedStatus === 'Inactivo'
                              ? 'bg-neutral-800 border-neutral-900 text-white shadow-xs'
                              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                          }`}
                        >
                          Inactivo
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedStatus('Activo')}
                          className={`py-3 px-4 rounded-2xl border-2 font-black text-xs sm:text-sm transition-all cursor-pointer ${
                            selectedStatus === 'Activo'
                              ? 'bg-[#1B4820] border-[#1B4820] text-white shadow-xs'
                              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                          }`}
                        >
                          Activo
                        </button>
                      </div>

                      {/* Motivos de inactivación si se selecciona Inactivo */}
                      {selectedStatus === 'Inactivo' && (
                        <div className="space-y-2.5 pt-1 animate-in fade-in">
                          <label className="block text-[11px] font-black text-neutral-700 uppercase tracking-wider">
                            Motivo de Inactivación:
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {INACTIVITY_REASONS.map(r => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setInactivityReason(r)}
                                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                  inactivityReason === r
                                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs ring-1 ring-amber-600/30'
                                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                                }`}
                              >
                                <span>{r}</span>
                                {inactivityReason === r && <Check className="w-4 h-4 text-amber-600 stroke-[3]" />}
                              </button>
                            ))}
                          </div>

                          <div>
                            <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 block">
                              {inactivityReason === 'Venta' ? 'Comprador o Destino:' : 'Detalles o Notas (Opcional):'}
                            </label>
                            <input
                              type="text"
                              placeholder={
                                inactivityReason === 'Venta'
                                  ? 'Ej. Nombre del comprador, finca o frigorífico de destino...'
                                  : 'Ej. Causa médica, observaciones, detalles...'
                              }
                              value={customInactivityNotes}
                              onChange={(e) => setCustomInactivityNotes(e.target.value)}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all placeholder:text-neutral-400"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </form>

          {/* 3. Footer de Acciones: El 'mt-auto' fuerza a este contenedor a irse al final del bloque blanco incondicionalmente */}
          <div className="mt-auto p-3.5 sm:p-5 border-t border-neutral-100 flex items-center justify-end gap-2 sm:gap-2.5 shrink-0 bg-neutral-50/80">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-neutral-600 hover:bg-neutral-200/60 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="bulk-edit-form"
              onClick={handleSubmit}
              disabled={isSubmitting || !Object.values(fieldsToEdit).some(Boolean)}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black bg-[#1B4820] hover:bg-[#143618] text-white transition-all cursor-pointer shadow-md shadow-[#1B4820]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando cambios...</span>
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
