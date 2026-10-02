import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Search, Plus, Check, ChevronDown, X, Dna } from 'lucide-react';

/**
 * GenealogySelector: Combobox reactivo para seleccionar padres (offline-first).
 * 
 * @param {string} label - Etiqueta del campo.
 * @param {string} value - UUID del animal seleccionado.
 * @param {function} onChange - Callback al seleccionar.
 * @param {string} sex - Filtro de sexo ('Macho' | 'Hembra').
 * @param {function} onCreateNew - Callback para abrir el modal de creación.
 */
export default function GenealogySelector({
  label,
  value,
  onChange,
  sex,
  onCreateNew
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Consulta reactiva a Dexie filtrando por sexo
  const animals = useLiveQuery(
    () => {
      let query = db.animals.where('sex').equals(sex);
      // Solo traemos los que no están eliminados lógicamente
      return query.and(a => !a.deleted_at).toArray();
    },
    [sex]
  );

  // 2. Filtrado local por término de búsqueda (número, raza o ID)
  const filteredResults = useMemo(() => {
    if (!animals) return [];
    if (!searchTerm.trim()) return animals.slice(0, 10);
    
    const term = searchTerm.toLowerCase().trim();
    return animals.filter(a => 
      (a.number && a.number.toLowerCase().includes(term)) || 
      (a.breed && a.breed.toLowerCase().includes(term)) ||
      (a.color && a.color.toLowerCase().includes(term)) ||
      (a.id && a.id.toLowerCase().includes(term))
    ).slice(0, 8);
  }, [animals, searchTerm]);

  // 3. Animal seleccionado (para mostrar el nombre/número en el input)
  const selectedAnimal = useMemo(() => {
    return animals?.find(a => a.id === value);
  }, [animals, value]);

  const handleSelect = (id) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="mb-4 last:mb-0 relative">
      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block ml-0.5">
        {label}
      </label>

      {/* Input / Trigger */}
      <div 
        onClick={() => setIsOpen(true)}
        className={`w-full bg-white rounded-2xl px-4 py-3.5 flex items-center justify-between border shadow-2xs transition-all cursor-pointer select-none ${
          isOpen ? 'border-[#1B4820]/40 ring-2 ring-[#1B4820]/20' : 'border-neutral-200 hover:border-neutral-300'
        }`}
      >
        <div className="flex items-center flex-1 gap-2.5 min-w-0">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder={selectedAnimal ? `#${selectedAnimal.number}${selectedAnimal.breed ? ` · ${selectedAnimal.breed}` : ''}` : `Buscar ${sex === 'Macho' ? 'Padre (Toro)' : 'Madre (Vaca)'}...`}
            className="flex-1 bg-transparent border-none outline-none text-neutral-800 placeholder-neutral-400 text-sm font-medium cursor-pointer"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
          />
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button 
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
              title="Limpiar selección"
            >
              <X className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-700" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#1B4820]' : ''}`} />
        </div>
      </div>

      {/* Dropdown Results con Animación Suave */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-30" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute z-40 w-full mt-1.5 bg-white rounded-2xl shadow-xl border border-neutral-200/90 overflow-hidden origin-top"
            >
              
              {/* Lista de Resultados */}
              <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-neutral-100">
                {filteredResults.length > 0 ? (
                  filteredResults.map((animal) => {
                    const isSelected = value === animal.id;
                    return (
                      <div
                        key={animal.id}
                        onClick={() => handleSelect(animal.id)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-emerald-50 text-[#1B4820] font-bold' 
                            : 'hover:bg-neutral-50 text-neutral-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-neutral-900">#{animal.number}</span>
                            {animal.breed && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-lg">
                                <Dna className="w-3 h-3 text-neutral-400" />
                                {animal.breed}
                              </span>
                            )}
                          </div>
                          {animal.color && (
                            <p className="text-[10px] text-neutral-400 uppercase tracking-wider mt-0.5 font-medium">{animal.color}</p>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#1B4820] shrink-0 ml-2" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-center text-neutral-400">
                    <p className="text-xs font-semibold">No se encontraron animales registrados.</p>
                  </div>
                )}
              </div>

              {/* Accion: Crear Nuevo */}
              <div className="p-2 border-t border-neutral-100 bg-neutral-50/70">
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew(sex);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-neutral-300 hover:border-[#1B4820] hover:text-[#1B4820] hover:bg-emerald-50 text-neutral-700 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-[#1B4820]" />
                  <span>REGISTRAR NUEVO {sex.toUpperCase()}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
