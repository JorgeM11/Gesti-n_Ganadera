import React, { useState, useMemo } from 'react';
import { 
  Syringe, 
  Pill, 
  Stethoscope, 
  Plus, 
  Filter, 
  ShieldCheck, 
  ShieldPlus, 
  Pencil, 
  Trash2, 
  Calendar, 
  Activity,
  Layers
} from 'lucide-react';
import { TbMedicineSyrup } from "react-icons/tb";
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { addToSyncQueue } from '@/lib/syncUtils';
import { formatShortDateLocal } from '@/lib/dateUtils';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import HealthForm from '@/components/inventario/HealthForm';

const PRODUCT_STYLES = {
  'Vacuna': { 
    icon: Syringe, 
    bg: 'bg-emerald-50', 
    text: 'text-[#1B4820]', 
    border: 'border-emerald-200/70', 
    badge: 'bg-emerald-100/90 text-[#1B4820]',
    ring: 'ring-emerald-500/20',
    hoverBorder: 'hover:border-emerald-300'
  },
  'Desparasitante': { 
    icon: TbMedicineSyrup, 
    bg: 'bg-amber-50', 
    text: 'text-[#8C6746]', 
    border: 'border-amber-200/70', 
    badge: 'bg-amber-100/90 text-[#8C6746]',
    ring: 'ring-amber-500/20',
    hoverBorder: 'hover:border-amber-300'
  },
  'Vitamina': { 
    icon: Pill, 
    bg: 'bg-lime-50', 
    text: 'text-[#4F663F]', 
    border: 'border-lime-200/70', 
    badge: 'bg-lime-100/90 text-[#4F663F]',
    ring: 'ring-lime-500/20',
    hoverBorder: 'hover:border-lime-300'
  },
  'Antibiótico': { 
    icon: Stethoscope, 
    bg: 'bg-rose-50', 
    text: 'text-[#D15555]', 
    border: 'border-rose-200/70', 
    badge: 'bg-rose-100/90 text-[#D15555]',
    ring: 'ring-rose-500/20',
    hoverBorder: 'hover:border-rose-300'
  },
};

export default function HealthTab({ animal }) {
  const animalId = animal?.id;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Consulta reactiva a registros de salud del animal ordenados cronológicamente
  const records = useLiveQuery(
    () => db.health_records
      .where('animal_id').equals(animalId)
      .and(r => !r.deleted_at)
      .toArray()
      .then(res => res.sort((a, b) => b.application_date.localeCompare(a.application_date))),
    [animalId]
  ) || [];

  // Métricas sanitarias computadas
  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return { total: 0, vaccines: 0, dewormers: 0, vitamins: 0, antibiotics: 0, lastDate: null, lastProduct: null, lastType: null };
    }
    const total = records.length;
    const vaccines = records.filter(r => r.product_type === 'Vacuna').length;
    const dewormers = records.filter(r => r.product_type === 'Desparasitante').length;
    const vitamins = records.filter(r => r.product_type === 'Vitamina').length;
    const antibiotics = records.filter(r => r.product_type === 'Antibiótico').length;
    const lastRecord = records[0];

    return {
      total,
      vaccines,
      dewormers,
      vitamins,
      antibiotics,
      lastDate: lastRecord ? formatShortDateLocal(lastRecord.application_date) : null,
      lastProduct: lastRecord ? lastRecord.product_name : null,
      lastType: lastRecord ? lastRecord.product_type : null,
    };
  }, [records]);

  // Registros filtrados según categoría seleccionada
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (selectedCategory === 'ALL') return records;
    return records.filter(r => r.product_type === selectedCategory);
  }, [records, selectedCategory]);

  // Eliminación con soft-delete y sincronización
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    try {
      const now = new Date().toISOString();
      await db.transaction('rw', [db.health_records, db.sync_queue], async () => {
        await db.health_records.update(recordToDelete.id, { deleted_at: now });
        await addToSyncQueue('health_records', 'PATCH', { id: recordToDelete.id, deleted_at: now });
      });
      setRecordToDelete(null);
    } catch (err) {
      console.error('Error eliminando registro médico:', err);
      alert('Hubo un problema al eliminar el registro médico.');
    }
  };

  if (!animal) return null;

  const categories = [
    { id: 'ALL', label: 'Todos', count: stats.total, icon: Layers },
    { id: 'Vacuna', label: 'Vacunas', count: stats.vaccines, icon: Syringe },
    { id: 'Desparasitante', label: 'Desparasitantes', count: stats.dewormers, icon: TbMedicineSyrup },
    { id: 'Vitamina', label: 'Vitaminas', count: stats.vitamins, icon: Pill },
    { id: 'Antibiótico', label: 'Antibióticos', count: stats.antibiotics, icon: Stethoscope },
  ];

  return (
    <div className="max-w-3xl mx-auto py-2 pb-24 relative">
      
      {/* 1. TÍTULO DE SECCIÓN Y ACCIONES */}
      <div className="mb-6 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EEF7EE] text-[#1B4820] rounded-2xl border border-[#1B4820]/10 shadow-2xs">
            <ShieldPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-[#1B4820] leading-tight">Carnet de Salud</h2>
            <p className="text-xs text-neutral-400 font-medium">Historial clínico</p>
          </div>
        </div>
        <div className="bg-[#EEF7EE] px-3.5 py-1.5 rounded-2xl text-[#1B4820] font-black text-base border border-[#1B4820]/10 shadow-2xs">
          #{animal.number}
        </div>
      </div>

      {/* 2. PANEL DE CONTROL SANITARIO (Métricas Ejecutivas) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Total de Tratamientos */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1B4820] flex items-center justify-center shrink-0 border border-emerald-100">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Tratamientos</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-neutral-900">{stats.total}</span>
              <span className="text-xs font-semibold text-neutral-400">aplicados</span>
            </div>
          </div>
        </div>

        {/* Última Aplicación */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm sm:col-span-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF7EE] text-[#1B4820] flex items-center justify-center shrink-0 border border-[#1B4820]/10">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Última Aplicación</span>
              {stats.lastProduct ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-neutral-900 truncate block">
                    {stats.lastProduct}
                  </span>
                  <span className="text-[10px] font-bold text-[#1B4820] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {stats.lastDate}
                  </span>
                </div>
              ) : (
                <span className="text-sm font-bold text-neutral-400 italic">Sin registros previos</span>
              )}
            </div>
          </div>
          {stats.lastType && (
            <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600">
              {stats.lastType}
            </span>
          )}
        </div>
      </div>

      {/* 3. FILTROS DE CATEGORÍA INTERACTIVOS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide -mx-1 px-1">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                if (document.documentElement) document.documentElement.scrollTop = 0;
                if (document.body) document.body.scrollTop = 0;
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'bg-[#1B4820] text-white shadow-md shadow-[#1B4820]/20'
                  : 'bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-300' : 'text-neutral-500'}`} />
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. LISTA DE TRATAMIENTOS */}
      <div className="space-y-3.5">
        {filteredRecords && filteredRecords.length > 0 ? (
          filteredRecords.map((item) => {
            const style = PRODUCT_STYLES[item.product_type] || { 
              icon: Stethoscope, 
              bg: 'bg-neutral-50', 
              text: 'text-neutral-700', 
              border: 'border-neutral-200', 
              badge: 'bg-neutral-100 text-neutral-700', 
              ring: 'ring-neutral-200',
              hoverBorder: 'hover:border-neutral-300'
            };
            const Icon = style.icon;
            
            return (
              <article 
                key={item.id} 
                onClick={() => setEditingRecord(item)}
                className={`group bg-white p-5 sm:p-6 rounded-3xl border border-neutral-100/90 shadow-sm hover:shadow-md ${style.hoverBorder} transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Círculo de Icono Temático */}
                  <div className={`w-12 h-12 rounded-2xl ${style.bg} ${style.text} flex items-center justify-center shrink-0 border ${style.border} shadow-2xs group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Detalle del Producto */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${style.badge}`}>
                        {item.product_type}
                      </span>
                      <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {formatShortDateLocal(item.application_date)}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-neutral-900 group-hover:text-[#1B4820] transition-colors leading-snug truncate">
                      {item.product_name}
                    </h4>

                    {item.dose && (
                      <p className="text-xs font-bold text-[#8C6746] flex items-center gap-1">
                        <span>Dosis:</span>
                        <span className="bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                          {item.dose} ml
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Acciones de Tarjeta */}
                <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecordToDelete(item);
                    }}
                    className="p-2.5 text-red-600 bg-red-50 md:text-neutral-400 md:bg-transparent md:hover:text-red-600 md:hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Eliminar tratamiento"
                    aria-label="Eliminar tratamiento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingRecord(item);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1B4820] bg-[#EEF7EE] border-[#1B4820]/20 md:text-neutral-600 md:bg-neutral-50 md:border-neutral-200/60 md:group-hover:text-[#1B4820] md:group-hover:bg-[#EEF7EE] md:group-hover:border-[#1B4820]/20 rounded-xl transition-colors cursor-pointer border"
                    title="Editar registro"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          /* Estado Vacío Moderno */
          <div className="bg-white rounded-3xl p-10 border border-neutral-100 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#1B4820] flex items-center justify-center mx-auto border border-emerald-100">
              <ShieldCheck className="w-8 h-8 opacity-70" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-black text-neutral-800">
                {selectedCategory === 'ALL' ? 'Sin registros médicos' : `Sin registros en ${selectedCategory}s`}
              </h3>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                {selectedCategory === 'ALL'
                  ? `Comienza registrando las vacunas, desparasitaciones o vitaminas administradas a #${animal.number}.`
                  : `No se encontraron tratamientos aplicados bajo la categoría seleccionada.`}
              </p>
            </div>
            {selectedCategory === 'ALL' ? (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-5 py-3 rounded-full text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Primer Tratamiento</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className="inline-flex items-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-4 py-2 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                <span>Ver Todos los Registros</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. BOTÓN FLOTANTE PARA MÓVIL (FAB) con animación rápida y suave */}
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
        title="Registrar Tratamiento"
        aria-label="Registrar Tratamiento"
      >
        <Plus className="w-4 h-4" />
        <span>Tratamiento</span>
      </motion.button>

      {/* 6. BOTÓN FLOTANTE REDONDO CON '+' PARA COMPUTADORA (DESKTOP) */}
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
        title="Registrar Nuevo Tratamiento"
        aria-label="Registrar Nuevo Tratamiento"
      >
        <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300" strokeWidth={2.5} />
      </motion.button>

      {/* 7. MODAL DE CREACIÓN DE TRATAMIENTO */}
      <BottomSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Registrar Tratamiento Médico"
        description={`Añade vacunas, desparasitantes, vitaminas o antibióticos para #${animal.number}`}
      >
        <HealthForm 
          animal={animal}
          onSubmitSuccess={() => setIsCreateOpen(false)}
          onCancel={() => setIsCreateOpen(false)}
          isModal
        />
      </BottomSheet>

      {/* 8. MODAL DE EDICIÓN DE TRATAMIENTO */}
      <BottomSheet
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        title="Editar Tratamiento"
        description={`Modifica el registro médico de ${editingRecord?.product_name || 'este tratamiento'}`}
      >
        <HealthForm 
          animal={animal}
          initialValues={editingRecord}
          onSubmitSuccess={() => setEditingRecord(null)}
          onCancel={() => setEditingRecord(null)}
          isModal
        />
      </BottomSheet>

      {/* 9. DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <ConfirmDialog
        isOpen={!!recordToDelete}
        title="¿Eliminar registro médico?"
        description={`¿Estás seguro de que deseas eliminar la aplicación de "${recordToDelete?.product_name}" del ${recordToDelete?.application_date ? formatShortDateLocal(recordToDelete.application_date) : ''}? Esta acción se sincronizará en todos tus dispositivos.`}
        confirmText="Eliminar"
        cancelText="Conservar"
        isDanger
        onConfirm={handleDeleteRecord}
        onCancel={() => setRecordToDelete(null)}
      />

    </div>
  );
}