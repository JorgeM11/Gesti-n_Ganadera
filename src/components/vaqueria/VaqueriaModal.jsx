import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, ClipboardCheck, Building2, FileText } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { createVaqueria, updateVaqueria } from '@/lib/vaqueriaUtils';
import CustomSelect from '@/components/ui/CustomSelect';

export default function VaqueriaModal({
  isOpen,
  onClose,
  initialData = null, // Si tiene datos, es modo edición
  initialFarmId = '',
  onSuccess
}) {
  const [name, setName] = useState('');
  const [farmId, setFarmId] = useState(initialFarmId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (initialData) {
        setName(initialData.name || '');
        setFarmId(initialData.farm_id || '');
        setDate(initialData.date || new Date().toISOString().split('T')[0]);
        setObservations(initialData.observations || '');
      } else {
        const today = new Date();
        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const defaultName = `Vaquería ${monthNames[today.getMonth()]} ${today.getFullYear()}`;
        setName(defaultName);
        setFarmId(initialFarmId || (farms.length > 0 ? farms[0].id : ''));
        setDate(today.toISOString().split('T')[0]);
        setObservations('');
      }
    }
  }, [isOpen, initialData, initialFarmId, farms.length]);

  if (!isOpen) return null;

  const farmOptions = farms.map(f => ({
    value: f.id,
    label: f.name
  }));

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    if (!name.trim()) {
      setError('El nombre de la vaquería es obligatorio');
      return;
    }

    if (!farmId) {
      setError('Debe seleccionar una finca asociada');
      return;
    }

    if (!date) {
      setError('La fecha es obligatoria');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (initialData?.id) {
        const updated = await updateVaqueria(initialData.id, {
          name: name.trim(),
          farm_id: initialData.farm_id || farmId,
          date,
          observations: observations.trim() || null
        });
        if (onSuccess) onSuccess(updated);
      } else {
        const created = await createVaqueria({
          farmId,
          name: name.trim(),
          date,
          observations: observations.trim() || null
        });
        if (onSuccess) onSuccess(created);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar la vaquería');
    } finally {
      setIsSaving(false);
    }
  };

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
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 leading-tight">
                  {initialData ? 'Editar Vaquería' : 'Nueva Vaquería'}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 md:p-6 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700">
                {error}
              </div>
            )}

            {/* Nombre */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                Nombre de la Vaquería *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Vaquería Octubre 2026"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Finca Asociada */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#1B4820]" /> Finca Asociada *
              </label>
              <CustomSelect
                options={farmOptions}
                value={farmId}
                onChange={setFarmId}
                placeholder="Seleccione la finca"
                disabled={Boolean(initialData)} // Si ya fue creada, la finca no se cambia para preservar historial
              />
              {Boolean(initialData) && (
                <p className="text-[11px] font-bold text-neutral-400 mt-1">
                  La finca asociada no se puede modificar una vez creada la vaquería.
                </p>
              )}
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1B4820]" /> Fecha de Asistencia *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-800 focus:bg-white focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all"
              />
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1B4820]" /> Observaciones o Notas (Opcional)
              </label>
              <textarea
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Condiciones climáticas, lote de ganado, personal a cargo..."
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-medium text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 py-3 px-4 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 px-4 bg-[#1B4820] text-white rounded-2xl text-sm font-black shadow-lg shadow-[#1B4820]/25 hover:bg-[#143618] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : (initialData ? 'Guardar' : 'Comenzar')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
