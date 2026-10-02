import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Plus, 
  Scale, 
  Ruler, 
  History,
  Calendar,
  Sparkles,
  MessageSquare,
  Pencil
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { db } from '@/lib/db';
import { formatWeight, formatDateLocal } from '@/lib/dateUtils';
import AnimalImage from '@/components/inventario/AnimalImage';
import BottomSheet from '@/components/ui/BottomSheet';
import EventForm from '@/components/inventario/EventForm';

/**
 * Retorna la configuración estética del badge según el tipo de evento
 */
function getEventTypeBadge(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('nacimiento')) {
    return {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      icon: Sparkles,
      dot: 'bg-emerald-500'
    };
  }
  if (t.includes('destete')) {
    return {
      bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
      icon: TrendingUp,
      dot: 'bg-amber-500'
    };
  }
  if (t.includes('meses') || t.includes('peso')) {
    return {
      bg: 'bg-sky-50 text-sky-800 border-sky-200/80',
      icon: Scale,
      dot: 'bg-sky-500'
    };
  }
  return {
    bg: 'bg-stone-100 text-stone-800 border-stone-200/80',
    icon: Calendar,
    dot: 'bg-stone-500'
  };
}

export default function EvolutionTab({ animal }) {
  const animalId = animal?.id;
  const [editingEvent, setEditingEvent] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Consulta reactiva a los eventos de crecimiento (orden descendente por fecha)
  const events = useLiveQuery(
    () => db.growth_events
      .where('animal_id').equals(animalId)
      .and(e => !e.deleted_at)
      .toArray()
      .then(res => res.sort((a, b) => b.event_date.localeCompare(a.event_date))),
    [animalId]
  );

  if (!animal) return null;

  return (
    <div className="max-w-3xl mx-auto py-2 pb-24 relative">
      
      {/* TÍTULO DE SECCIÓN Y ACCIONES */}
      <div className="mb-6 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EEF7EE] text-[#1B4820] rounded-2xl border border-[#1B4820]/10">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-[#1B4820] leading-tight">Evolución</h2>
            <p className="text-xs text-neutral-400 font-medium">Historial cronológico</p>
          </div>
        </div>
        <div className="bg-[#EEF7EE] px-3.5 py-1.5 rounded-2xl text-[#1B4820] font-black text-base border border-[#1B4820]/10">
          #{animal.number}
        </div>
      </div>

      {/* LÍNEA DE TIEMPO DE EVENTOS */}
      <div className="relative pl-6 sm:pl-8 border-l-2 border-emerald-600/20 space-y-6 ml-3 sm:ml-4">
        {events && events.length > 0 ? (
          events.map((event, i) => {
            const badge = getEventTypeBadge(event.event_type);
            // Calcular delta de peso respecto al evento cronológicamente anterior (events[i + 1])
            const prevEvent = events[i + 1];
            const weightDiff = (event.weight_kg !== null && event.weight_kg !== undefined && prevEvent?.weight_kg !== null && prevEvent?.weight_kg !== undefined)
              ? (Number(event.weight_kg) - Number(prevEvent.weight_kg)).toFixed(1)
              : null;

            return (
              <div key={event.id} className="relative">
                {/* Nodo en la línea de tiempo */}
                <div className={`absolute -left-[31px] sm:-left-[39px] top-4 w-4 h-4 rounded-full border-[3px] border-[#F7F7F2] shadow-sm z-10 transition-colors ${
                  i === 0 ? 'bg-[#1B4820] ring-4 ring-emerald-100 animate-pulse' : 'bg-neutral-300'
                }`} />

                {/* Tarjeta de Evento */}
                <article 
                  className="flex flex-col bg-white rounded-3xl overflow-hidden shadow-xs hover:shadow-md border border-neutral-100 hover:border-emerald-200/80 transition-all duration-300 group cursor-pointer active:scale-[0.99]"
                  onClick={() => setEditingEvent(event)}
                >
                  {/* Imagen del Evento (solo si existe) */}
                  {(event.photo_blob || event.photo_path) && (
                    <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-neutral-100">
                      <AnimalImage 
                        photoPath={event.photo_path}
                        photoBlob={event.photo_blob}
                        alt={event.event_type}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white border border-white/20 px-3 py-1 rounded-full text-[10px] font-bold">
                        {formatDateLocal(event.event_date)}
                      </div>
                    </div>
                  )}

                  <div className="p-4 sm:p-6 space-y-4">
                    {/* Cabecera del Evento */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${badge.bg}`}>
                          <badge.icon className="w-3.5 h-3.5" />
                          <span>{event.event_type}</span>
                        </span>
                        {!(event.photo_blob || event.photo_path) && (
                          <span className="text-xs font-bold text-neutral-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            {formatDateLocal(event.event_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        
                        <div className="text-[#1B4820] bg-emerald-50 md:text-neutral-400 md:bg-transparent md:group-hover:text-[#1B4820] md:group-hover:bg-emerald-50 p-2 rounded-xl transition-all">
                          <Pencil className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Métricas Principales */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-start">
                      {event.weight_kg !== null && event.weight_kg !== undefined && (
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <DataBox 
                            icon={Scale} 
                            label="Peso" 
                            value={formatWeight(event.weight_kg)}
                          />
                          {weightDiff !== null && (
                            <div className="flex items-center px-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border leading-none shrink-0 ${
                                Number(weightDiff) >= 0 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' 
                                  : 'bg-rose-50 text-rose-800 border-rose-200/80'
                              }`}>
                                {Number(weightDiff) >= 0 ? <TrendingUp className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> : <TrendingDown className="w-2.5 h-2.5 text-rose-600 shrink-0" />}
                                <span>{Number(weightDiff) >= 0 ? `+${weightDiff} kg` : `${weightDiff} kg`}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {event.mother_weight_kg && (
                        <DataBox icon={Scale} label="Peso Madre" value={formatWeight(event.mother_weight_kg)} />
                      )}
                      {event.scrotal_circumference_cm && (
                        <DataBox icon={Ruler} label="Circ. Escrotal" value={`${event.scrotal_circumference_cm} cm`} />
                      )}
                      {event.navel_length && (
                        <DataBox icon={Ruler} label="Largo Ombligo" value={`${event.navel_length}`} />
                      )}
                    </div>

                    {/* Observaciones */}
                    {event.observations && (
                      <div className="bg-[#F8F9F5] p-3.5 rounded-2xl border border-neutral-100/80 flex items-start gap-2.5">
                        <MessageSquare className="w-4 h-4 text-[#1B4820] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                          {event.observations}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-neutral-100 shadow-2xs text-center space-y-4">
            <div className="p-4 bg-emerald-50 text-[#1B4820] rounded-3xl">
              <History className="w-10 h-10 opacity-70" />
            </div>
            <div className="max-w-xs">
              <h3 className="text-base font-black text-neutral-800">Sin eventos de evolución</h3>
              <p className="text-xs text-neutral-400 font-medium mt-1">
                Registra el nacimiento, destete o pesajes para monitorear el desarrollo de #{animal.number}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-5 py-3 rounded-full text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Primer Evento</span>
            </button>
          </div>
        )}
      </div>

      {/* Botón Flotante para MÓVIL (FAB) con animación rápida y suave */}
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
        title="Registrar Evento"
        aria-label="Registrar Evento"
      >
        <Plus className="w-4 h-4" />
        <span>Evento</span>
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
        title="Registrar Nuevo Evento"
        aria-label="Registrar Nuevo Evento"
      >
        <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300" strokeWidth={2.5} />
      </motion.button>

      {/* MODAL DE CREACIÓN DE EVENTO */}
      <BottomSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Registrar Evento de Evolución"
        description={`Añade un pesaje o evento de desarrollo para #${animal.number}`}
      >
        <EventForm 
          animal={animal}
          existingEvents={events || []}
          onSubmitSuccess={() => setIsCreateOpen(false)}
          onCancel={() => setIsCreateOpen(false)}
          isModal
        />
      </BottomSheet>

      {/* MODAL DE EDICIÓN DE EVENTO */}
      <BottomSheet
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title="Editar Evento"
        description={`Modifica los detalles del registro de ${editingEvent?.event_type}`}
      >
        <EventForm 
          animal={animal}
          initialValues={editingEvent}
          existingEvents={events || []}
          onSubmitSuccess={() => setEditingEvent(null)}
          onCancel={() => setEditingEvent(null)}
          isModal
        />
      </BottomSheet>

    </div>
  );
}

function DataBox({ icon: Icon, label, value }) {
  return (
    <div className="bg-neutral-50 p-2.5 sm:p-3 rounded-2xl border border-neutral-100/90 flex flex-col justify-between min-w-0">
      <div className="flex items-center gap-1.5 text-neutral-400 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-[#1B4820]/70 shrink-0" />
        <p className="text-[10px] font-black uppercase tracking-wider truncate">{label}</p>
      </div>
      <p className="text-sm sm:text-base font-black text-neutral-800 leading-none">{value}</p>
    </div>
  );
}