import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Building2, Plus, Users, Pencil, Trash2, ChevronDown, Check } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { createFarm, updateFarm } from '@/lib/farmUtils';
import { createPotrero, updatePotrero, deletePotrero } from '@/lib/potreroUtils';

export default function FarmModal({ isOpen, onClose, onFarmCreated, onFarmUpdated, initialView = 'list' }) {
  const [activeView, setActiveView] = useState(initialView); // 'list' | 'create' | 'edit'
  const [editingFarm, setEditingFarm] = useState(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Estados para Potreros por Finca
  const [expandedFarmId, setExpandedFarmId] = useState(null);
  const [newPotreroName, setNewPotreroName] = useState('');
  const [editingPotreroId, setEditingPotreroId] = useState(null);
  const [editingPotreroName, setEditingPotreroName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveView(initialView);
      setError('');
      setEditingFarm(null);
      setName('');
      setLocation('');
      setDescription('');
      setExpandedFarmId(null);
      setNewPotreroName('');
      setEditingPotreroId(null);
    }
  }, [isOpen, initialView]);

  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted_at).toArray()) || [];
  const potreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray()) || [];

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

  const handleAddPotrero = async (farmId) => {
    if (!newPotreroName.trim()) return;
    try {
      await createPotrero({ farm_id: farmId, name: newPotreroName.trim() });
      setNewPotreroName('');
    } catch (err) {
      alert(err.message || 'Error al agregar potrero');
    }
  };

  const handleSaveEditPotrero = async (potreroId) => {
    if (!editingPotreroName.trim()) return;
    try {
      await updatePotrero(potreroId, { name: editingPotreroName.trim() });
      setEditingPotreroId(null);
      setEditingPotreroName('');
    } catch (err) {
      alert(err.message || 'Error al actualizar potrero');
    }
  };

  const handleDeletePotrero = async (potrero) => {
    const potreroAnimalsCount = animals.filter(a => a.potrero_id === potrero.id).length;
    const msg = potreroAnimalsCount > 0
      ? `Este potrero tiene ${potreroAnimalsCount} animal(es). ¿Seguro de eliminarlo? Los animales quedarán sin potrero asignado.`
      : `¿Eliminar el potrero "${potrero.name}"?`;
    if (window.confirm(msg)) {
      try {
        await deletePotrero(potrero.id);
      } catch (err) {
        alert('Error al eliminar potrero');
      }
    }
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
                    const farmPotreros = potreros.filter(p => p.farm_id === f.id);
                    const isExpanded = expandedFarmId === f.id;

                    return (
                      <div
                        key={f.id}
                        className="bg-neutral-50 rounded-2xl border border-neutral-200/70 overflow-hidden transition-all shadow-2xs"
                      >
                        <div className="p-3.5">
                          <div className="flex items-center justify-between gap-3">
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
                                  <p className="text-[10px] text-neutral-400 truncate max-w-[240px]">{f.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/60" title={`${farmAnimalsCount} animales`}>
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

                          {/* Botón de Potreros ubicado abajo de la información de la finca */}
                          <div className="pt-2.5 mt-2.5 border-t border-neutral-200/70">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedFarmId(isExpanded ? null : f.id);
                                setNewPotreroName('');
                                setEditingPotreroId(null);
                              }}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between cursor-pointer ${
                                isExpanded
                                  ? 'bg-[#1B4820] text-white border-[#1B4820] shadow-2xs'
                                  : 'bg-white text-neutral-700 border-neutral-200 hover:border-[#1B4820] hover:text-[#1B4820]'
                              }`}
                              title="Gestionar potreros de esta finca"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] uppercase tracking-wider font-black">Potreros</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                  isExpanded ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
                                }`}>
                                  {farmPotreros.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-medium opacity-80">
                                <span>{isExpanded ? 'Ocultar' : 'Ver y Administrar'}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Panel Expandible de Potreros de la Finca */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="bg-white border-t border-neutral-200/80 p-3.5 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <h5 className="text-[11px] font-black uppercase text-[#1B4820] tracking-wider">
                                  Potreros en {f.name}
                                </h5>
                                <span className="text-[10px] text-neutral-400 font-bold">
                                  {farmPotreros.length} registrado(s)
                                </span>
                              </div>

                              {/* Formulario rápido para añadir potrero */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Nombre del nuevo potrero..."
                                  value={newPotreroName}
                                  onChange={(e) => setNewPotreroName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddPotrero(f.id);
                                    }
                                  }}
                                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#1B4820]/20 font-medium"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddPotrero(f.id)}
                                  className="bg-[#1B4820] hover:bg-[#0F2912] text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Agregar</span>
                                </button>
                              </div>

                              {/* Lista de Potreros de esta finca */}
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                                {farmPotreros.length === 0 ? (
                                  <p className="text-[11px] text-neutral-400 italic py-2 text-center">
                                    No hay potreros en esta finca aún.
                                  </p>
                                ) : (
                                  farmPotreros.map(pot => {
                                    const potAnimalsCount = animals.filter(a => a.potrero_id === pot.id).length;
                                    const isEditingThis = editingPotreroId === pot.id;

                                    if (isEditingThis) {
                                      return (
                                        <div key={pot.id} className="flex items-center gap-2 p-1 bg-neutral-50 rounded-xl border border-neutral-200">
                                          <input
                                            type="text"
                                            value={editingPotreroName}
                                            onChange={(e) => setEditingPotreroName(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveEditPotrero(pot.id);
                                              }
                                            }}
                                            className="flex-1 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#1B4820]"
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSaveEditPotrero(pot.id)}
                                            className="p-1 rounded bg-[#1B4820] text-white hover:bg-emerald-950 cursor-pointer"
                                            title="Guardar"
                                          >
                                            <Check className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingPotreroId(null)}
                                            className="p-1 rounded text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                            title="Cancelar"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div
                                        key={pot.id}
                                        className="flex items-center justify-between p-2 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200/50 transition-all text-xs"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-bold text-neutral-800 truncate">{pot.name}</span>
                                          <span className="text-[10px] text-neutral-400 font-semibold shrink-0">
                                            ({potAnimalsCount} animales)
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingPotreroId(pot.id);
                                              setEditingPotreroName(pot.name);
                                            }}
                                            className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                            title="Editar nombre"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePotrero(pot)}
                                            className="p-1 text-red-400 hover:text-red-600 cursor-pointer"
                                            title="Eliminar potrero"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
