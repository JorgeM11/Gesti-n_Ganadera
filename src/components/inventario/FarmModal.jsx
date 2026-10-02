import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Building2, Plus, Users, Pencil } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { createFarm, updateFarm } from '@/lib/farmUtils';

export default function FarmModal({ isOpen, onClose, onFarmCreated, onFarmUpdated, initialView = 'list' }) {
  const [activeView, setActiveView] = useState(initialView); // 'list' | 'create' | 'edit'
  const [editingFarm, setEditingFarm] = useState(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveView(initialView);
      setError('');
      setEditingFarm(null);
      setName('');
      setLocation('');
      setDescription('');
    }
  }, [isOpen, initialView]);

  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted_at).toArray()) || [];

  const handleStartCreate = () => {
    setEditingFarm(null);
    setName('');
    setLocation('');
    setDescription('');
    setError('');
    setActiveView('create');
  };

  const handleStartEdit = (farm) => {
    setEditingFarm(farm);
    setName(farm.name || '');
    setLocation(farm.location || '');
    setDescription(farm.description || '');
    setError('');
    setActiveView('edit');
  };

  const handleBackToList = () => {
    setEditingFarm(null);
    setName('');
    setLocation('');
    setDescription('');
    setError('');
    setActiveView('list');
  };

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (!name.trim()) {
      setError('El nombre de la finca es obligatorio');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      if (editingFarm) {
        const updated = await updateFarm(editingFarm.id, {
          name: name.trim(),
          location: location.trim(),
          description: description.trim()
        });
        if (onFarmUpdated) onFarmUpdated(updated);
      } else {
        const newFarm = await createFarm({
          name: name.trim(),
          location: location.trim(),
          description: description.trim()
        });
        if (onFarmCreated) onFarmCreated(newFarm);
      }
      handleBackToList();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar la finca');
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Fondo oscuro con fade in / fade out suave */}
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
            className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 relative z-10"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1B4820]/10 flex items-center justify-center text-[#1B4820]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {activeView === 'edit' ? 'Editar Finca' : 'Gestión de Fincas'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {activeView === 'edit' ? `Modificando "${editingFarm?.name}"` : 'Fincas y haciendas ganaderas'}
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

            {/* Pestañas de Navegación */}
            <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-2xl">
              <button
                type="button"
                onClick={handleBackToList}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'list'
                    ? 'bg-white text-[#1B4820] shadow-xs'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                Fincas Registradas ({farms.length})
              </button>

              <button
                type="button"
                onClick={activeView === 'edit' ? undefined : handleStartCreate}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeView === 'create' || activeView === 'edit'
                    ? 'bg-[#1B4820] text-white shadow-xs'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                {activeView === 'edit' ? (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editando Finca</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nueva Finca</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-semibold p-3 rounded-xl border border-red-200/60">
                {error}
              </div>
            )}

            {activeView === 'list' ? (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {farms.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold uppercase tracking-wider">No hay fincas registradas aún</p>
                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="mt-3 text-xs font-bold text-[#1B4820] underline cursor-pointer"
                    >
                      Registrar la primera finca
                    </button>
                  </div>
                ) : (
                  farms.map((f) => {
                    const farmAnimalsCount = animals.filter(a => a.farm_id === f.id).length;
                    return (
                      <div
                        key={f.id}
                        className="p-3.5 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200/70 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-neutral-200 text-[#1B4820] shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-neutral-900 truncate">{f.name}</h4>
                            {f.location && (
                              <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                                <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                                <span className="truncate">{f.location}</span>
                              </div>
                            )}
                            {f.description && (
                              <p className="text-[10px] text-neutral-400 truncate max-w-[200px]">{f.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/60">
                            <Users className="w-3 h-3 text-emerald-600" />
                            {farmAnimalsCount}
                          </span>

                          {/* Botón de Editar Finca */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(f)}
                            className="p-2 rounded-xl text-[#1B4820] bg-emerald-50 border border-emerald-200/80 md:bg-white md:text-neutral-600 md:border-neutral-200/80 md:hover:bg-[#1B4820] md:hover:text-white transition-all shadow-2xs cursor-pointer"
                            title={`Editar ${f.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit(e);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                    Nombre de la Finca *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Hacienda El Mirador"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1B4820]/20"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                    Ubicación / Sector
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ej. Calabozo, Guárico"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1B4820]/20"
                    />
                    <MapPin className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                    Descripción / Notas
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notas sobre potreros, capacidad o características..."
                    rows={2}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1B4820]/20 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold py-3.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="flex-1 bg-[#1B4820] hover:bg-emerald-950 text-white text-xs font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                  >
                    {isSaving ? 'Guardando...' : (editingFarm ? 'Actualizar Finca' : 'Guardar Finca')}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
