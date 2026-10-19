import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserX, AlertTriangle, Check } from 'lucide-react';
import { inactivateAnimalDirectly } from '@/lib/vaqueriaUtils';

const INACTIVITY_REASONS = [
  'Muerte',
  'Venta',
  'Descarte',
  'Pérdida / Extravío',
  'Traslado a otra finca',
  'Otro motivo'
];

export default function InactivateAnimalModal({
  isOpen,
  onClose,
  animal,
  onSuccess
}) {
  const [reason, setReason] = useState('Muerte');
  const [customNotes, setCustomNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !animal) return null;

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    setIsSubmitting(true);
    setError('');

    try {
      const fullReason = customNotes.trim()
        ? `${reason}: ${customNotes.trim()}`
        : reason;

      const updated = await inactivateAnimalDirectly({
        animalId: animal.id,
        reason: fullReason
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al inactivar animal');
    } finally {
      setIsSubmitting(false);
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
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 leading-tight">
                  Inactivar Animal Faltante
                </h3>
                <p className="text-xs font-bold text-neutral-400">
                  Arete #{animal.number} {animal.name ? `• ${animal.name}` : ''}
                </p>
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
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
              <p className="text-xs font-medium text-amber-900">
                Este animal estaba registrado como <strong>Activo</strong> pero no se presentó en la vaquería. Al inactivarlo, se registrará el motivo y dejará de contarse en el rebaño productivo.
              </p>
            </div>

            {/* Motivo de Inactivación */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2">
                Motivo de Inactivación *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {INACTIVITY_REASONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      reason === r
                        ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{r}</span>
                    {reason === r && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Observaciones detalladas */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                Detalles adicionales (Opcional)
              </label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Fecha aproximada, comprador, causa médica o detalle..."
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-medium text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15 outline-none transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-amber-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-amber-600/25 hover:bg-amber-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Inactivando...' : 'Inactivar'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
