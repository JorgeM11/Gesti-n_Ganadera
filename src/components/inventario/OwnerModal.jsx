import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Users, Pencil, Trash2, UserCheck, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { createOwner, updateOwner, deleteOwner } from '@/lib/ownerUtils';

export default function OwnerModal({ isOpen, onClose, onOwnerCreated, onOwnerUpdated, initialView = 'list' }) {
  const [activeView, setActiveView] = useState(initialView); // 'list' | 'create' | 'edit'
  const [editingOwner, setEditingOwner] = useState(null);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveView(initialView);
      setError('');
      setEditingOwner(null);
      setName('');
      setSearch('');
    }
  }, [isOpen, initialView]);

  const owners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted_at).toArray()) || [];

  const filteredOwners = owners.filter(o => 
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartCreate = () => {
    setEditingOwner(null);
    setName('');
    setError('');
    setActiveView('create');
  };

  const handleStartEdit = (owner) => {
    setEditingOwner(owner);
    setName(owner.name || '');
    setError('');
    setActiveView('edit');
  };

  const handleBackToList = () => {
    setEditingOwner(null);
    setName('');
    setError('');
    setActiveView('list');
  };

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (!name.trim()) {
      setError('El nombre del dueño es obligatorio');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      if (editingOwner) {
        const updated = await updateOwner(editingOwner.id, {
          name: name.trim()
        });
        if (onOwnerUpdated) onOwnerUpdated(updated);
      } else {
        const newOwner = await createOwner({
          name: name.trim()
        });
        if (onOwnerCreated) onOwnerCreated(newOwner);
      }
      handleBackToList();
    } catch (err) {
      setError(err.message || 'Error al guardar el dueño');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (owner) => {
    const ownerAnimalsCount = animals.filter(a => a.owner_id === owner.id).length;
    const confirmMessage = ownerAnimalsCount > 0 
      ? `Este dueño tiene ${ownerAnimalsCount} animal(es) asignado(s). ¿Deseas eliminarlo? Los animales quedarán sin dueño asignado.`
      : `¿Eliminar a "${owner.name}"?`;

    if (window.confirm(confirmMessage)) {
      try {
        await deleteOwner(owner.id);
      } catch (err) {
        alert('Error al eliminar el dueño');
      }
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
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {activeView === 'edit' ? 'Editar Dueño' : 'Gestión de Dueños'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {activeView === 'edit' ? `Modificando "${editingOwner?.name}"` : 'Propietarios y titulares de animales'}
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
                Dueños Registrados ({owners.length})
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
                    <span>Editando Dueño</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Dueño</span>
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
              <div className="space-y-3">
                {owners.length > 4 && (
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#1B4820]/20"
                    />
                  </div>
                )}

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {filteredOwners.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400">
                      <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-bold uppercase tracking-wider">
                        {search ? 'No se encontraron dueños' : 'No hay dueños registrados aún'}
                      </p>
                      {!search && (
                        <button
                          type="button"
                          onClick={handleStartCreate}
                          className="mt-3 text-xs font-bold text-[#1B4820] underline cursor-pointer"
                        >
                          Registrar el primer dueño
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredOwners.map((owner) => {
                      const ownerAnimalsCount = animals.filter(a => a.owner_id === owner.id).length;
                      return (
                        <div
                          key={owner.id}
                          className="p-3.5 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200/70 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-neutral-200 text-[#1B4820] shrink-0 font-black text-sm">
                              {owner.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-neutral-900 truncate">{owner.name}</h4>
                              <p className="text-[11px] text-neutral-400">Propietario registrado</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/60" title={`${ownerAnimalsCount} animales asignados`}>
                              <Users className="w-3 h-3 text-emerald-600" />
                              {ownerAnimalsCount}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(owner)}
                              className="p-2 rounded-xl text-[#1B4820] bg-emerald-50 border border-emerald-200/80 md:bg-white md:text-neutral-600 md:border-neutral-200/80 md:hover:bg-[#1B4820] md:hover:text-white transition-all shadow-2xs cursor-pointer"
                              title={`Editar ${owner.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(owner)}
                              className="p-2 rounded-xl text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all shadow-2xs cursor-pointer border border-red-200/60"
                              title={`Eliminar ${owner.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 block ml-1">
                    Nombre del Dueño *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Juan Pérez, Hacienda San José C.A."
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1 ml-1">
                    Solo se requiere el nombre del propietario para vincular a los animales.
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
                    disabled={isSaving}
                    className="flex-1 bg-[#1B4820] hover:bg-[#0F2912] text-white text-xs font-bold py-3.5 rounded-2xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : (activeView === 'edit' ? 'Guardar Cambios' : 'Registrar Dueño')}
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
