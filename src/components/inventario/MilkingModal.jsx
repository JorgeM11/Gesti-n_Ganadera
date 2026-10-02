import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Milk } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { createMilkingRecord, updateMilkingRecord } from '@/lib/milkingUtils';
import CustomSelect from '@/components/ui/CustomSelect';

export default function MilkingModal({ 
  isOpen, 
  onClose, 
  animal, 
  onRecordCreated,
  onRecordUpdated,
  recordToEdit = null 
}) {
  const [selectedAnimalId, setSelectedAnimalId] = useState(animal?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('Mañana');
  const [liters, setLiters] = useState('');
  const [observations, setObservations] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Cargar vacas si no vino animal preseleccionado
  const femaleCows = useLiveQuery(
    () => db.animals.filter(a => a.sex === 'Hembra' && !a.deleted_at).toArray(),
    []
  ) || [];

  useEffect(() => {
    if (recordToEdit) {
      setSelectedAnimalId(recordToEdit.animal_id || animal?.id || '');
      setDate(recordToEdit.milking_date || new Date().toISOString().split('T')[0]);
      setShift(recordToEdit.shift || 'Mañana');
      setLiters(recordToEdit.liters !== undefined && recordToEdit.liters !== null ? String(recordToEdit.liters) : '');
      setObservations(recordToEdit.observations || '');
      setError('');
    } else {
      if (animal) {
        setSelectedAnimalId(animal.id);
      } else if (femaleCows.length > 0 && !selectedAnimalId) {
        setSelectedAnimalId(femaleCows[0].id);
      }
      setDate(new Date().toISOString().split('T')[0]);
      setShift('Mañana');
      setLiters('');
      setObservations('');
      setError('');
    }
  }, [recordToEdit, isOpen, animal, femaleCows]);

  const currentAnimal = animal || femaleCows.find(a => a.id === selectedAnimalId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentAnimal && !recordToEdit) {
      setError('Debes seleccionar una vaca para registrar el ordeño');
      return;
    }

    const parsed = Number(liters);
    if (!liters || isNaN(parsed) || parsed <= 0) {
      setError('Ingresa una cantidad válida de litros mayor a 0');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      if (recordToEdit) {
        const updated = await updateMilkingRecord({
          id: recordToEdit.id,
          milking_date: date,
          shift,
          liters: parsed,
          observations
        });
        setLiters('');
        setObservations('');
        if (onRecordUpdated) onRecordUpdated(updated, currentAnimal);
      } else {
        const record = await createMilkingRecord({
          animal_id: currentAnimal.id,
          farm_id: currentAnimal.farm_id || null,
          milking_date: date,
          shift,
          liters: parsed,
          observations
        });
        setLiters('');
        setObservations('');
        if (onRecordCreated) onRecordCreated(record, currentAnimal);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el registro de ordeño');
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop con fade in / fade out suave */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
          />

          {/* Tarjeta del modal con animación elástica suave */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 relative z-10"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Milk className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {recordToEdit ? 'Editar Registro de Ordeño' : 'Registro de Ordeño'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {currentAnimal 
                      ? `Vaca: #${currentAnimal.number} ${currentAnimal.breed ? `(${currentAnimal.breed})` : ''}`
                      : 'Control lechero diario'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-600 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-semibold p-3 rounded-xl border border-red-200/60">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!animal && !recordToEdit && (
                <div>
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                    Seleccionar Vaca *
                  </label>
                  <CustomSelect
                    value={selectedAnimalId}
                    onChange={setSelectedAnimalId}
                    options={femaleCows.map(cow => ({
                      value: cow.id,
                      label: `#${cow.number} - ${cow.breed || 'Vaca'}`
                    }))}
                    placeholder="Selecciona una vaca..."
                    bgClass="bg-neutral-50"
                    searchable={true}
                    searchPlaceholder="Buscar vaca por código o raza..."
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                  Fecha de Ordeño *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1B4820]/20 text-neutral-800 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                  Turno *
                </label>
                <CustomSelect
                  value={shift}
                  onChange={setShift}
                  options={[
                    { value: 'Mañana', label: 'Turno Mañana' },
                    { value: 'Tarde', label: 'Turno Tarde' },
                    { value: 'Único', label: 'Turno Único / Día Completo' }
                  ]}
                  bgClass="bg-neutral-50"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                  Litros Producidos *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                    placeholder="Ej. 14.5"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1B4820]/20"
                    required
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-neutral-400">Lts</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                  Observaciones (Opcional)
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ej. Buena ubre, ordeño manual..."
                  rows={2}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#1B4820]/20 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1B4820] hover:bg-emerald-950 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Guardando...' : (recordToEdit ? 'Guardar' : 'Registrar')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
