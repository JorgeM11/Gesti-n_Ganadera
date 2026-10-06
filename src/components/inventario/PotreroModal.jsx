import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Pencil, Fence, Building2, Search, AlertCircle } from 'lucide-react';
import { GiCow } from 'react-icons/gi';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { createPotrero, updatePotrero } from '@/lib/potreroUtils';
import CustomSelect from '@/components/ui/CustomSelect';

export default function PotreroModal({ 
  isOpen, 
  onClose, 
  onPotreroCreated, 
  onPotreroUpdated, 
  initialView = 'list',
  defaultFarmId = ''
}) {
  const [activeView, setActiveView] = useState(initialView); // 'list' | 'create' | 'edit'
  const [editingPotrero, setEditingPotrero] = useState(null);
  const [name, setName] = useState('');
  const [farmId, setFarmId] = useState(defaultFarmId || '');
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const potreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray()) || [];
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted_at).toArray()) || [];

  const farmMap = useMemo(() => {
    const map = {};
    farms.forEach(f => {
      map[f.id] = f.name;
    });
    return map;
  }, [farms]);

  useEffect(() => {
    if (isOpen) {
      setActiveView(initialView);
      setError('');
      setEditingPotrero(null);
      setName('');
      setFarmId(defaultFarmId || (farms.length > 0 ? farms[0].id : ''));
      setSearch('');
    }
  }, [isOpen, initialView, defaultFarmId, farms]);

  const filteredPotreros = useMemo(() => {
    return potreros.filter(p => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const pName = (p.name || '').toLowerCase();
      const fName = (farmMap[p.farm_id] || '').toLowerCase();
      return pName.includes(s) || fName.includes(s);
    });
  }, [potreros, search, farmMap]);

  const handleStartCreate = () => {
    setEditingPotrero(null);
    setName('');
    setFarmId(defaultFarmId || (farms.length > 0 ? farms[0].id : ''));
    setError('');
    setActiveView('create');
  };

  const handleStartEdit = (potrero) => {
    setEditingPotrero(potrero);
    setName(potrero.name || '');
    setFarmId(potrero.farm_id || '');
    setError('');
    setActiveView('edit');
  };

  const handleBackToList = () => {
    setEditingPotrero(null);
    setName('');
    setFarmId(defaultFarmId || (farms.length > 0 ? farms[0].id : ''));
    setError('');
    setActiveView('list');
  };

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    if (!name.trim()) {
      setError('El nombre del potrero es obligatorio');
      return;
    }

    if (!farmId) {
      setError('Debes seleccionar una finca asociada');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (editingPotrero) {
        const updated = await updatePotrero(editingPotrero.id, {
          name: name.trim(),
          farm_id: farmId
        });
        if (onPotreroUpdated) onPotreroUpdated(updated);
      } else {
        const newPotrero = await createPotrero({
          name: name.trim(),
          farm_id: farmId
        });
        if (onPotreroCreated) onPotreroCreated(newPotrero);
      }
      handleBackToList();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el potrero');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
          />

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
                  <Fence className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {activeView === 'edit' ? 'Editar Potrero' : 'Gestión de Potreros'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {activeView === 'edit' ? `Modificando "${editingPotrero?.name}"` : 'Potreros por finca'}
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
                Potreros ({potreros.length})
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
                    <span>Editando Potrero</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Potrero</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-semibold p-3 rounded-xl border border-red-200/60 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeView === 'list' ? (
              <div className="space-y-3">
                {potreros.length > 4 && (
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por potrero o finca..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#1B4820]/20"
                    />
                  </div>
                )}

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {filteredPotreros.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400">
                      <Fence className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-bold uppercase tracking-wider">
                        {search ? 'No se encontraron potreros' : 'No hay potreros registrados aún'}
                      </p>
                      {!search && (
                        <button
                          type="button"
                          onClick={handleStartCreate}
                          className="mt-4 inline-flex items-center justify-center gap-2 bg-[#1B4820] hover:bg-[#0F2912] active:scale-[0.98] text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-md shadow-[#1B4820]/15 transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Registrar Nuevo Potrero</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredPotreros.map((potrero) => {
                      const potreroAnimalsCount = animals.filter(a => a.potrero_id === potrero.id).length;
                      const farmName = farmMap[potrero.farm_id] || 'Finca no especificada';
                      return (
                        <div
                          key={potrero.id}
                          className="p-3.5 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200/70 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-neutral-200 text-[#1B4820] shrink-0">
                              <Fence className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-neutral-900 truncate">{potrero.name}</h4>
                              <p className="text-[11px] text-neutral-500 truncate flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-neutral-400 shrink-0" />
                                <span>{farmName}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/60" 
                              title={`${potreroAnimalsCount} animales en este potrero`}
                            >
                              <GiCow className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {potreroAnimalsCount}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(potrero)}
                              className="p-2 rounded-xl text-[#1B4820] bg-emerald-50 border border-emerald-200/80 md:bg-white md:text-neutral-600 md:border-neutral-200/80 md:hover:bg-[#1B4820] md:hover:text-white transition-all shadow-2xs cursor-pointer"
                              title={`Editar ${potrero.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit();
                }}
                className="space-y-4"
              >
                {/* Nombre del potrero */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 block ml-1">
                    Nombre del Potrero *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Potrero 1"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all"
                    autoFocus
                  />
                </div>

                {/* Finca asociada */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 block ml-1">
                    Finca Asociada *
                  </label>
                  {farms.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-2xl text-xs text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>No hay fincas registradas aún. Debes registrar una finca primero.</span>
                    </div>
                  ) : (
                    <CustomSelect
                      value={farmId}
                      onChange={(val) => setFarmId(val)}
                      options={farms.map((f) => ({
                        value: f.id,
                        label: `${f.name}${f.location ? ` (${f.location})` : ''}`
                      }))}
                      placeholder="Selecciona la finca..."
                      bgClass="bg-neutral-50"
                      searchable={farms.length > 5}
                    />
                  )}
                  <p className="text-[11px] text-neutral-400 mt-1 ml-1">
                    El potrero debe pertenecer a una finca.
                  </p>
                </div>

                <div className="flex gap-3 pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold py-3.5 rounded-2xl transition-colors cursor-pointer"
                  >
                    Volver al listado
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || farms.length === 0}
                    className="flex-1 bg-[#1B4820] hover:bg-[#0F2912] text-white text-xs font-bold py-3.5 rounded-2xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : (activeView === 'edit' ? 'Guardar' : 'Registrar')}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
