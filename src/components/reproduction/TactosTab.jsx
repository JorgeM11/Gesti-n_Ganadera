import React, { useState } from 'react';
import { 
  Stethoscope, 
  Plus, 
  Pencil, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { addToSyncQueue } from '@/lib/syncUtils';
import { formatShortDateLocal, formatDateLocal } from '@/lib/dateUtils';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TactoForm from '@/components/inventario/TactoForm';

export default function TactosTab({ animal }) {
  const animalId = animal?.id;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState(null);
  const [checkToDelete, setCheckToDelete] = useState(null);

  const checks = useLiveQuery(
    () => db.pregnancy_checks
      .where('animal_id').equals(animalId)
      .and(c => !c.deleted_at)
      .toArray()
      .then(res => res.sort((a, b) => b.check_date.localeCompare(a.check_date))),
    [animalId]
  ) || [];

  const handleDeleteCheck = async () => {
    if (!checkToDelete) return;
    try {
      const now = new Date().toISOString();
      await db.transaction('rw', [db.pregnancy_checks, db.sync_queue], async () => {
        await db.pregnancy_checks.update(checkToDelete.id, { deleted_at: now });
        await addToSyncQueue('pregnancy_checks', 'PATCH', { id: checkToDelete.id, deleted_at: now });
      });
      setCheckToDelete(null);
    } catch (err) {
      console.error('Error eliminando palpación:', err);
      alert('Hubo un problema al eliminar la palpación.');
    }
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      {checks && checks.length > 0 ? (
        <div className="space-y-3">
          {checks.map((check) => {
            const isPregnant = check.result === 'Preñada';

            return (
              <article 
                key={check.id} 
                onClick={() => setEditingCheck(check)}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-100/90 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Círculo de Icono */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs group-hover:scale-105 transition-transform ${
                    isPregnant 
                      ? 'bg-emerald-50 text-[#1B4820] border-emerald-100' 
                      : 'bg-rose-50 text-[#D15555] border-rose-100'
                  }`}>
                    <Stethoscope className="w-6 h-6" />
                  </div>

                  {/* Información de Palpación */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        isPregnant 
                          ? 'bg-emerald-100/90 text-[#1B4820] border-emerald-200/60' 
                          : 'bg-rose-100/90 text-[#D15555] border-rose-200/60'
                      }`}>
                        {isPregnant ? (
                          <CheckCircle2 className="w-3 h-3 text-[#1B4820]" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-[#D15555]" />
                        )}
                        <span>{check.result || 'Sin Diagnóstico'}</span>
                      </span>

                      <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {formatShortDateLocal(check.check_date)}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-neutral-900 group-hover:text-[#1B4820] transition-colors leading-snug">
                      Diagnóstico: {check.result}
                    </h4>

                    {check.observations && (
                      <p className="text-xs text-neutral-500 italic pt-0.5 leading-relaxed">
                        "{check.observations}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Acciones de la tarjeta */}
                <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCheckToDelete(check);
                    }}
                    className="p-2.5 text-red-600 bg-red-50 md:text-neutral-400 md:bg-transparent md:hover:text-red-600 md:hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Eliminar palpación"
                    aria-label="Eliminar palpación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCheck(check);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1B4820] bg-[#EEF7EE] border-[#1B4820]/20 md:text-neutral-600 md:bg-neutral-50 md:border-neutral-200/60 md:group-hover:text-[#1B4820] md:group-hover:bg-[#EEF7EE] md:group-hover:border-[#1B4820]/20 rounded-xl transition-colors cursor-pointer border"
                    title="Editar palpación"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Estado Vacío */
        <div className="bg-white rounded-3xl p-10 border border-neutral-100 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#1B4820] flex items-center justify-center mx-auto border border-emerald-100">
            <Stethoscope className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-black text-neutral-800">Sin palpaciones registradas</h3>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              No hay diagnósticos de tacto rectal o ecografía para #{animal?.number || 'este animal'}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-5 py-3 rounded-full text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Primera Palpación</span>
          </button>
        </div>
      )}

      {/* Botón Flotante para MÓVIL (FAB) */}
      <motion.button 
        initial={{ opacity: 0, scale: 0.88, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 8 }}
        transition={{ 
          type: "spring", 
          stiffness: 450, 
          damping: 30, 
          mass: 0.6 
        }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsCreateOpen(true)}
        className="fixed bottom-20 right-4 z-30 md:hidden flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-4 py-3 rounded-full shadow-[0_8px_25px_rgba(27,72,32,0.4)] border border-emerald-600/30 cursor-pointer text-xs uppercase tracking-wider backdrop-blur-xs"
        title="Registrar Palpación"
        aria-label="Registrar Palpación"
      >
        <Plus className="w-4 h-4" />
        <span>Palpación</span>
      </motion.button>

      {/* Botón Flotante Redondo con '+' para COMPUTADORA (DESKTOP) */}
      <motion.button 
        initial={{ opacity: 0, scale: 0.88, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 8 }}
        transition={{ 
          type: "spring", 
          stiffness: 450, 
          damping: 30, 
          mass: 0.6 
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsCreateOpen(true)}
        className="fixed bottom-8 right-8 z-30 hidden md:flex items-center justify-center w-14 h-14 bg-[#1B4820] hover:bg-[#123316] text-white rounded-full shadow-[0_10px_30px_rgba(27,72,32,0.45)] border border-emerald-600/30 cursor-pointer transition-colors group"
        title="Registrar Nueva Palpación"
        aria-label="Registrar Nueva Palpación"
      >
        <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300" strokeWidth={2.5} />
      </motion.button>

      {/* MODAL DE CREACIÓN DE PALPACIÓN */}
      <BottomSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Registrar Palpación / Tacto"
        description={`Diagnóstico de preñez para #${animal?.number || ''}`}
      >
        <div className="pb-8">
          <TactoForm
            animal={animal}
            onSubmitSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
            isModal={true}
          />
        </div>
      </BottomSheet>

      {/* MODAL DE EDICIÓN DE PALPACIÓN */}
      <BottomSheet
        isOpen={!!editingCheck}
        onClose={() => setEditingCheck(null)}
        title="Editar Palpación"
        description={editingCheck ? `Modificar diagnóstico del ${formatDateLocal(editingCheck.check_date)}` : ''}
      >
        <div className="pb-8">
          <TactoForm
            animal={animal}
            initialValues={editingCheck}
            onSubmitSuccess={() => setEditingCheck(null)}
            onCancel={() => setEditingCheck(null)}
            isModal={true}
          />
        </div>
      </BottomSheet>

      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <ConfirmDialog
        isOpen={!!checkToDelete}
        title="¿Eliminar diagnóstico de tacto?"
        description={`¿Estás seguro de que deseas eliminar la palpación del ${checkToDelete ? formatDateLocal(checkToDelete.check_date) : ''} (${checkToDelete?.result})? Esta acción se sincronizará con la nube.`}
        confirmText="Eliminar Palpación"
        cancelText="Conservar"
        isDanger
        onConfirm={handleDeleteCheck}
        onCancel={() => setCheckToDelete(null)}
      />
    </div>
  );
}