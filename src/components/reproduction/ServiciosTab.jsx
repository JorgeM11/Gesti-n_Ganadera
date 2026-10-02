import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Calendar, 
  FlaskConical, 
  HeartHandshake, 
  ArrowUpRight 
} from 'lucide-react';
import { FaVenusMars } from 'react-icons/fa6';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { addToSyncQueue } from '@/lib/syncUtils';
import { formatShortDateLocal, formatDateLocal } from '@/lib/dateUtils';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ServicioForm from '@/components/inventario/ServicioForm';

export default function ServiciosTab({ animal }) {
  const animalId = animal?.id;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  const services = useLiveQuery(
    async () => {
      if (!animalId) return [];
      const svcs = await db.services
        .where('mother_id').equals(animalId)
        .toArray()
        .then(res => res.sort((a, b) => b.service_date.localeCompare(a.service_date)));
      
      const filteredSvcs = svcs.filter(s => !s.deleted_at);

      const fatherIds = filteredSvcs.map(s => s.father_id).filter(Boolean);
      const fathers = fatherIds.length > 0 ? await db.animals.where('id').anyOf(fatherIds).toArray() : [];
      
      const fatherMap = {};
      fathers.forEach(f => { fatherMap[f.id] = f.number; });

      return filteredSvcs.map(service => ({
        ...service,
        father_number: service.father_id ? (fatherMap[service.father_id] || null) : null
      }));
    },
    [animalId]
  ) || [];

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      const now = new Date().toISOString();
      await db.transaction('rw', [db.services, db.sync_queue], async () => {
        await db.services.update(serviceToDelete.id, { deleted_at: now });
        await addToSyncQueue('services', 'PATCH', { id: serviceToDelete.id, deleted_at: now });
      });
      setServiceToDelete(null);
    } catch (err) {
      console.error('Error eliminando servicio:', err);
      alert('Hubo un problema al eliminar el servicio.');
    }
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      {services && services.length > 0 ? (
        <div className="space-y-3">
          {services.map((service) => {
            const isIA = service.type_conception === 'IA' || service.type_conception === 'Inseminación Artificial';
            const TypeIcon = isIA ? FlaskConical : HeartHandshake;

            return (
              <article 
                key={service.id} 
                onClick={() => setEditingService(service)}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-100/90 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Círculo de Icono */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs group-hover:scale-105 transition-transform ${
                    isIA 
                      ? 'bg-blue-50 text-blue-800 border-blue-100' 
                      : 'bg-emerald-50 text-[#1B4820] border-emerald-100'
                  }`}>
                    <TypeIcon className="w-6 h-6" />
                  </div>

                  {/* Datos del Servicio */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        isIA 
                          ? 'bg-blue-100/90 text-blue-800 border-blue-200/60' 
                          : 'bg-emerald-100/90 text-[#1B4820] border-emerald-200/60'
                      }`}>
                        {isIA ? 'Inseminación Artificial' : 'Monta Natural'}
                      </span>

                      <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {formatShortDateLocal(service.service_date)}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-neutral-900 group-hover:text-[#1B4820] transition-colors leading-snug">
                      {isIA ? 'Inseminación Artificial (IA)' : 'Monta Natural (MN)'}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-neutral-600 font-medium pt-0.5 flex-wrap">
                      <span className="text-neutral-400">Padre / Pajuela:</span>
                      {service.father_id ? (
                        <Link 
                          to={`/inventario/perfil?id=${service.father_id}&tab=details`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 font-black text-[#1B4820] bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                          title="Ver detalles del toro"
                        >
                          <span>Toro #{service.father_number || service.father_id.split('-')[0]}</span>
                          <ArrowUpRight className="w-3 h-3 text-[#1B4820]" />
                        </Link>
                      ) : (
                        <span className="text-neutral-400 italic">No especificado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones de Tarjeta */}
                <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setServiceToDelete(service);
                    }}
                    className="p-2.5 text-red-600 bg-red-50 md:text-neutral-400 md:bg-transparent md:hover:text-red-600 md:hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Eliminar servicio"
                    aria-label="Eliminar servicio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingService(service);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1B4820] bg-[#EEF7EE] border-[#1B4820]/20 md:text-neutral-600 md:bg-neutral-50 md:border-neutral-200/60 md:group-hover:text-[#1B4820] md:group-hover:bg-[#EEF7EE] md:group-hover:border-[#1B4820]/20 rounded-xl transition-colors cursor-pointer border"
                    title="Editar servicio"
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
            <FaVenusMars className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-black text-neutral-800">Sin servicios registrados</h3>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              No se han registrado montas naturales ni inseminaciones para #{animal?.number || 'este animal'}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-5 py-3 rounded-full text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Primer Servicio</span>
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
        title="Registrar Servicio"
        aria-label="Registrar Servicio"
      >
        <Plus className="w-4 h-4" />
        <span>Servicio</span>
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
        title="Registrar Nuevo Servicio"
        aria-label="Registrar Nuevo Servicio"
      >
        <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300" strokeWidth={2.5} />
      </motion.button>

      {/* MODAL DE CREACIÓN DE SERVICIO */}
      <BottomSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Registrar Servicio Reproductivo"
        description={`Monta o inseminación para #${animal?.number || ''}`}
      >
        <div className="pb-8">
          <ServicioForm
            animal={animal}
            onSubmitSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
            isModal={true}
          />
        </div>
      </BottomSheet>

      {/* MODAL DE EDICIÓN DE SERVICIO */}
      <BottomSheet
        isOpen={!!editingService}
        onClose={() => setEditingService(null)}
        title="Editar Servicio"
        description={editingService ? `Modificar servicio del ${formatDateLocal(editingService.service_date)}` : ''}
      >
        <div className="pb-8">
          <ServicioForm
            animal={animal}
            initialValues={editingService}
            onSubmitSuccess={() => setEditingService(null)}
            onCancel={() => setEditingService(null)}
            isModal={true}
          />
        </div>
      </BottomSheet>

      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <ConfirmDialog
        isOpen={!!serviceToDelete}
        title="¿Eliminar servicio reproductivo?"
        description={`¿Estás seguro de que deseas eliminar el servicio del ${serviceToDelete ? formatDateLocal(serviceToDelete.service_date) : ''}? Esta acción se sincronizará con la nube.`}
        confirmText="Eliminar Servicio"
        cancelText="Conservar"
        isDanger
        onConfirm={handleDeleteService}
        onCancel={() => setServiceToDelete(null)}
      />
    </div>
  );
}