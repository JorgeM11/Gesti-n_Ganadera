import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, Cpu, Building2, Fence, UserCheck, AlertTriangle } from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { completeUnregisteredAnimal, isValidChipNumber } from '@/lib/vaqueriaUtils';
import CustomSelect from '@/components/ui/CustomSelect';

const COMMON_BREEDS = [
  'Mestizo',
  'Brahman Blanco',
  'Brahman Rojo',
  'Gyr',
  'Guzerá',
  'Carora',
  'Holstein',
  'Jersey',
  'Senepol',
  'Angus',
  'Brangus',
  'Sin raza'
];

export default function CompleteAnimalModal({
  isOpen,
  onClose,
  vaqueriaAnimal,
  farmId,
  onSuccess
}) {
  const [number, setNumber] = useState('');
  const [chipNumber, setChipNumber] = useState('');
  const [name, setName] = useState('');
  const [sex, setSex] = useState('Hembra');
  const [breed, setBreed] = useState('Mestizo');
  const [color, setColor] = useState('');
  const [potreroId, setPotreroId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Consultas auxiliares de potreros y dueños
  const potreros = useLiveQuery(
    () => db.potreros.where('farm_id').equals(farmId).and(p => !p.deleted_at).toArray(),
    [farmId]
  ) || [];

  const owners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];

  useEffect(() => {
    if (isOpen && vaqueriaAnimal) {
      setError('');
      if (vaqueriaAnimal.identification_type === 'name') {
        setName(vaqueriaAnimal.name || vaqueriaAnimal.scanned_code || '');
        setNumber(vaqueriaAnimal.number || '');
        setChipNumber(vaqueriaAnimal.chip_number || '');
      } else if (vaqueriaAnimal.identification_type === 'chip') {
        setChipNumber(vaqueriaAnimal.chip_number || vaqueriaAnimal.scanned_code || '');
        setNumber(vaqueriaAnimal.number || '');
        setName(vaqueriaAnimal.name || '');
      } else {
        setNumber(vaqueriaAnimal.number || vaqueriaAnimal.scanned_code || '');
        setName(vaqueriaAnimal.name || '');
        setChipNumber(vaqueriaAnimal.chip_number || '');
      }
      setSex('Hembra');
      setBreed('Mestizo');
      setColor('');
      setPotreroId('');
      setOwnerId('');
      setBirthDate('');
    }
  }, [isOpen, vaqueriaAnimal]);

  if (!isOpen || !vaqueriaAnimal) return null;

  const potreroOptions = [
    { value: '', label: 'Sin potrero asignado' },
    ...potreros.map(p => ({ value: p.id, label: p.name }))
  ];

  const ownerOptions = [
    { value: '', label: 'Sin dueño asignado' },
    ...owners.map(o => ({ value: o.id, label: o.name }))
  ];

  const breedOptions = COMMON_BREEDS.map(b => ({ value: b, label: b }));

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    const cleanNumber = number.trim();
    const cleanChip = chipNumber.trim();
    const cleanName = name.trim();

    // Validar que se suministre al menos uno: Arete o Microchip
    if (!cleanNumber && !cleanChip) {
      setError('Debes ingresar al menos el Número de Arete o el Microchip RFID.');
      return;
    }

    // Si se proporciona microchip, validar formato de 15 dígitos
    if (cleanChip && !isValidChipNumber(cleanChip)) {
      setError('El microchip RFID debe tener exactamente 15 dígitos numéricos.');
      return;
    }

    // Comprobar que el arete no esté duplicado en la misma finca (solo si se especificó arete)
    if (cleanNumber) {
      const existingSameNumber = await db.animals
        .where('farm_id')
        .equals(farmId)
        .and(a => !a.deleted_at && a.number && a.number.trim().toLowerCase() === cleanNumber.toLowerCase())
        .first();

      if (existingSameNumber) {
        setError(`Ya existe un animal con el arete #${cleanNumber} en esta finca.`);
        return;
      }
    }

    // Comprobar que el chip no esté duplicado globalmente (solo si se especificó chip)
    if (cleanChip) {
      const existingSameChip = await db.animals
        .filter(a => !a.deleted_at && a.chip_number && a.chip_number.trim() === cleanChip)
        .first();

      if (existingSameChip) {
        const ident = existingSameChip.number ? `#${existingSameChip.number}` : (existingSameChip.name || 'registrado en inventario');
        setError(`El microchip ${cleanChip} ya está asignado al animal ${ident}.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      const created = await completeUnregisteredAnimal({
        vaqueriaAnimalId: vaqueriaAnimal.id,
        animalData: {
          farm_id: farmId,
          potrero_id: potreroId || null,
          owner_id: ownerId || null,
          number: cleanNumber,
          chip_number: cleanChip || null,
          name: cleanName || null,
          sex,
          breed,
          color: color.trim() || null,
          birth_date: birthDate || null
        }
      });

      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al completar registro del animal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1B4820] text-white flex items-center justify-center shadow-md shadow-[#1B4820]/20">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 leading-tight">
                  Completar Registro
                </h3>
                <p className="text-xs text-neutral-500 font-medium">
                  {vaqueriaAnimal.identification_type === 'chip'
                    ? `Microchip: ${vaqueriaAnimal.chip_number || vaqueriaAnimal.scanned_code}`
                    : (vaqueriaAnimal.identification_type === 'name' && (vaqueriaAnimal.name || vaqueriaAnimal.scanned_code)
                        ? `Animal: ${vaqueriaAnimal.name || vaqueriaAnimal.scanned_code}`
                        : `Arete: #${vaqueriaAnimal.number || vaqueriaAnimal.scanned_code}`)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 md:p-6 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Arete */}
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#1B4820]" /> Número de Arete
                  </span>
                  {!chipNumber.trim() && (
                    <span className="text-[10px] text-amber-700 font-semibold lowercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      o chip
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Ej. 104"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-black text-neutral-900 focus:bg-white focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all"
                />
              </div>

              {/* Chip */}
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#1B4820]" /> Microchip RFID
                  </span>
                  {!number.trim() && (
                    <span className="text-[10px] text-amber-700 font-semibold lowercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      o arete
                    </span>
                  )}
                </label>
                <input
                  type="tel"
                  value={chipNumber}
                  onChange={(e) => setChipNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder="Ej. 982000361284915"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-900 focus:bg-white focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 font-medium -mt-2">
              * Identificación requerida: ingresa número de arete, microchip RFID, o ambos.
            </p>

            {/* Nombre y Sexo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                  Nombre (Opcional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Mariposa"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-900 focus:bg-white focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all"
                />
              </div>

              {/* Sexo Segmentado */}
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                  Sexo *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSex('Hembra')}
                    className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      sex === 'Hembra'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <FaVenus className="w-3.5 h-3.5 text-rose-600" />
                    Hembra
                  </button>

                  <button
                    type="button"
                    onClick={() => setSex('Macho')}
                    className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      sex === 'Macho'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <FaMars className="w-3.5 h-3.5 text-blue-600" />
                    Macho
                  </button>
                </div>
              </div>
            </div>

            {/* Raza y Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                  Raza
                </label>
                <CustomSelect
                  options={breedOptions}
                  value={breed}
                  onChange={setBreed}
                  placeholder="Selecciona la raza"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                  Color (Opcional)
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Ej. Blanco con manchas negras"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-900 focus:bg-white border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all"
                />
              </div>
            </div>

            {/* Potrero y Dueño */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Fence className="w-3.5 h-3.5 text-[#1B4820]" /> Potrero
                </label>
                <CustomSelect
                  options={potreroOptions}
                  value={potreroId}
                  onChange={setPotreroId}
                  placeholder="Selecciona potrero"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#1B4820]" /> Dueño
                </label>
                <CustomSelect
                  options={ownerOptions}
                  value={ownerId}
                  onChange={setOwnerId}
                  placeholder="Selecciona dueño"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-[#1B4820] text-white rounded-2xl text-sm font-black shadow-lg shadow-[#1B4820]/25 hover:bg-[#143618] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
