import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * CustomSelect: Selector estilizado flotante que no deforma el layout padre.
 * 
 * @param {string} value - El valor seleccionado.
 * @param {function} onChange - Callback cuando cambia la selección.
 * @param {Array} options - Arreglo de { value: string, label: string }.
 * @param {string} placeholder - Texto por defecto.
 * @param {string} label - Etiqueta opcional arriba del input.
 * @param {string} bgClass - Clase de fondo (ej: 'bg-white' o 'bg-neutral-50').
 * @param {boolean} searchable - Si es true, añade buscador en la parte superior.
 * @param {string} searchPlaceholder - Placeholder para el input de búsqueda.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  label,
  bgClass = 'bg-white',
  searchable = false,
  searchPlaceholder = 'Buscar opción...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Limpiar búsqueda al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      String(opt.value).toLowerCase().includes(query)
    );
  }, [options, searchable, searchQuery]);

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-30' : 'z-10'}`}>
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">
          {label}
        </label>
      )}

      {/* Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${bgClass} rounded-2xl px-4 py-3.5 flex items-center justify-between border shadow-2xs transition-all cursor-pointer select-none ${
          isOpen ? 'border-[#1B4820]/40 ring-2 ring-[#1B4820]/20' : 'border-neutral-200 hover:border-neutral-300'
        }`}
      >
        <span className={`text-sm truncate pr-2 ${selectedOption ? 'text-neutral-900 font-semibold' : 'text-neutral-400 font-medium'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#1B4820]' : ''}`} 
        />
      </div>

      {/* Dropdown Flotante (no agranda el modal) con Animación Suave */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute top-full left-0 w-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-neutral-200/90 z-40 overflow-hidden"
          >
            {/* Buscador interno si searchable es true */}
            {searchable && (
              <div className="p-2 border-b border-neutral-100 bg-neutral-50/50 sticky top-0 z-10">
                <div className="relative flex items-center bg-white rounded-xl px-3 py-2 border border-neutral-200 focus-within:border-[#1B4820] shadow-2xs">
                  <Search className="w-4 h-4 text-neutral-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs font-medium text-neutral-800 placeholder-neutral-400"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery('');
                      }}
                      className="p-1 hover:bg-neutral-100 rounded-md text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Lista de Opciones con scroll */}
            <div className="max-h-52 overflow-y-auto divide-y divide-neutral-50 p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      value === option.value
                        ? 'bg-emerald-50/90 text-[#1B4820] font-bold'
                        : 'text-neutral-700 hover:bg-neutral-100 font-medium'
                    }`}
                  >
                    <span className="text-xs truncate">{option.label}</span>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-[#1B4820] shrink-0 ml-2" />
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs text-neutral-400 italic">No se encontraron opciones</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
