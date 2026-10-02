import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Milk, Plus, Calendar, Clock, Droplet, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { formatDateLocal } from '@/lib/dateUtils';
import { deleteMilkingRecord } from '@/lib/milkingUtils';
import MilkingModal from '@/components/inventario/MilkingModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function MilkingTab({ animal }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Consulta reactiva a registros de ordeño de esta vaca
  const records = useLiveQuery(
    () => {
      if (!animal?.id) return [];
      return db.milking_records
        .where('animal_id')
        .equals(animal.id)
        .and(r => !r.deleted_at)
        .reverse()
        .sortBy('milking_date');
    },
    [animal?.id]
  ) || [];

  // Cálculos estadísticos
  const stats = useMemo(() => {
    if (records.length === 0) {
      return { total: 0, average: 0, daysCount: 0, today: 0 };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const total = records.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);

    const byDate = {};
    for (const r of records) {
      byDate[r.milking_date] = (byDate[r.milking_date] || 0) + (Number(r.liters) || 0);
    }

    const daysCount = Object.keys(byDate).length;
    const average = daysCount > 0 ? total / daysCount : 0;
    const today = byDate[todayStr] || 0;

    return {
      total: Number(total.toFixed(1)),
      average: Number(average.toFixed(1)),
      daysCount,
      today: Number(today.toFixed(1))
    };
  }, [records]);

  // Handler de eliminación de registro de ordeño
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    try {
      await deleteMilkingRecord(recordToDelete.id);
      setRecordToDelete(null);
    } catch (err) {
      console.error('Error eliminando registro de ordeño:', err);
      alert('Hubo un problema al eliminar el registro de ordeño.');
    }
  };

  const handleOpenCreate = () => {
    setRecordToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setRecordToEdit(record);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-28 sm:pb-12 relative">
      {/* 1. TÍTULO DE SECCIÓN */}
      <div className="mb-2 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EEF7EE] text-[#1B4820] rounded-2xl border border-[#1B4820]/10 shadow-2xs">
            <Milk className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-[#1B4820] leading-tight">Control de Ordeño</h2>
            <p className="text-xs text-neutral-400 font-medium">Historial</p>
          </div>
        </div>
        <div className="bg-[#EEF7EE] px-3.5 py-1.5 rounded-2xl text-[#1B4820] font-black text-base border border-[#1B4820]/10 shadow-2xs">
          #{animal?.number}
        </div>
      </div>

      {/* TARJETAS RESUMEN DE PRODUCCIÓN */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-neutral-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Histórico</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-[#1B4820]">{stats.total}</span>
            <span className="text-xs font-bold text-neutral-500">Lts</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-neutral-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Promedio Diario</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-blue-600">{stats.average}</span>
            <span className="text-xs font-bold text-neutral-500">L/día</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-neutral-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Hoy</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-emerald-600">{stats.today}</span>
            <span className="text-xs font-bold text-neutral-500">Lts</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-neutral-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Días Ordeño</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-neutral-800">{stats.daysCount}</span>
            <span className="text-xs font-bold text-neutral-500">días</span>
          </div>
        </div>
      </div>

      {/* LISTADO DE ORDEÑOS */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-neutral-100 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
          <Milk className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-black text-neutral-900 uppercase tracking-wider">
            Historial de Ordeños ({records.length})
          </h4>
        </div>

        {records.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 space-y-3">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <Droplet className="w-8 h-8 opacity-70" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h4 className="text-base font-black text-neutral-800">No hay registros de ordeño</h4>
              <p className="text-xs text-neutral-400">Comienza registrando la producción lechera de #{animal?.number || 'esta vaca'}.</p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-5 py-3 rounded-full text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Primer Ordeño</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {records.map((r) => (
              <div 
                key={r.id} 
                onClick={() => handleOpenEdit(r)}
                className="py-3.5 px-3 -mx-3 rounded-2xl flex items-center justify-between hover:bg-neutral-50/80 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100/60 shadow-2xs group-hover:scale-105 transition-transform">
                    <Milk className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-neutral-800">
                        {formatDateLocal(r.milking_date)}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                        {r.shift}
                      </span>
                    </div>
                    {r.observations && (
                      <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{r.observations}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-black text-blue-700">
                      {r.liters} L
                    </span>
                  </div>

                  {/* Acciones de Edición y Eliminación */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(r);
                      }}
                      className="p-2 text-[#1B4820] bg-[#EEF7EE] md:text-neutral-400 md:bg-transparent md:hover:text-[#1B4820] md:hover:bg-[#EEF7EE] rounded-xl transition-colors cursor-pointer"
                      title="Editar registro"
                      aria-label="Editar registro"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecordToDelete(r);
                      }}
                      className="p-2 text-red-600 bg-red-50 md:text-neutral-400 md:bg-transparent md:hover:text-red-600 md:hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar registro"
                      aria-label="Eliminar registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE PARA MÓVIL (FAB) con animación rápida y elástica */}
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
        onClick={handleOpenCreate}
        className="fixed bottom-20 right-4 z-30 md:hidden flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-4 py-3 rounded-full shadow-[0_8px_25px_rgba(27,72,32,0.4)] border border-emerald-600/30 cursor-pointer text-xs uppercase tracking-wider backdrop-blur-xs"
        title="Registrar Ordeño"
        aria-label="Registrar Ordeño"
      >
        <Plus className="w-4 h-4" />
        <span>Ordeño</span>
      </motion.button>

      {/* BOTÓN FLOTANTE REDONDO CON '+' PARA COMPUTADORA (DESKTOP) */}
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
        onClick={handleOpenCreate}
        className="fixed bottom-8 right-8 z-30 hidden md:flex items-center justify-center w-14 h-14 bg-[#1B4820] hover:bg-[#123316] text-white rounded-full shadow-[0_10px_30px_rgba(27,72,32,0.45)] border border-emerald-600/30 cursor-pointer transition-colors group"
        title="Registrar Nuevo Ordeño"
        aria-label="Registrar Nuevo Ordeño"
      >
        <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300" strokeWidth={2.5} />
      </motion.button>

      {/* MODAL DE ORDEÑO (CREACIÓN Y EDICIÓN) */}
      <MilkingModal
        isOpen={isModalOpen}
        animal={animal}
        recordToEdit={recordToEdit}
        onClose={() => {
          setIsModalOpen(false);
          setRecordToEdit(null);
        }}
      />

      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <ConfirmDialog
        isOpen={!!recordToDelete}
        title="Eliminar Registro de Ordeño"
        description={`¿Estás seguro de que deseas eliminar este registro de ${recordToDelete?.liters} L (${recordToDelete?.shift}) del ${recordToDelete ? formatDateLocal(recordToDelete.milking_date) : ''}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={handleDeleteRecord}
        onCancel={() => setRecordToDelete(null)}
      />
    </div>
  );
}

