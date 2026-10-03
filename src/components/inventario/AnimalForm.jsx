import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Save, X, Trash2, Plus, 
  CheckCircle, Building2, Dna, 
  Scale, Calendar, IdCard, Cpu, Tag, 
  Palette, UserCheck, ShieldAlert
} from 'lucide-react';
import { GiCow } from 'react-icons/gi';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';

import { db } from '@/lib/db';
import { addToSyncQueue } from '@/lib/syncUtils';
import { compressImage } from '@/lib/imageUtils';
import GenealogySelector from './GenealogySelector';
import FarmModal from './FarmModal';
import PotreroModal from './PotreroModal';
import OwnerModal from './OwnerModal';
import CustomSelect from '@/components/ui/CustomSelect';
import { DateInput } from '@/components/ui/DateInput';

// Lista de razas populares con "Sin raza" al inicio
const POPULAR_BREEDS_LIST = [
  'Sin raza',
  'Mestizo',
  'Brahman',
  'Gyr',
  'Guzerá',
  'Nelore',
  'Carora',
  'Holstein',
  'Jersey',
  'Pardo Suizo',
  'Senepol',
  'Angus',
  'Simmental',
  'Charolais',
  'Brangus',
  'Braford',
  'Girolando',
  'Criollo Limonero'
];

// Esquema Zod ajustado al orden y requerimientos exactos
const animalSchema = z.object({
  // 1. Número de arete
  number: z.string().min(1, 'El número de arete es obligatorio'),
  // 2. Número de chip
  chip_number: z.string().nullable().optional(),
  // 3. Nombre (opcional)
  name: z.string().nullable().optional(),
  // 4. Género
  sex: z.enum(['Macho', 'Hembra']),
  // 5. Fecha de nacimiento
  birth_date: z.string().nullable().optional().refine(val => !val || new Date(val) <= new Date(), { message: 'La fecha no puede ser futura' }),
  // 6. Peso (opcional)
  current_weight_kg: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  // 7. Color (opcional)
  color: z.string().nullable().optional(),
  // 8. Dueño
  owner_id: z.string().nullable().optional(),
  // 9. Finca
  farm_id: z.string().nullable().optional(),
  // 10. Potrero (dependiente de finca)
  potrero_id: z.string().nullable().optional(),
  // 11. Madre y Padre
  father_id: z.string().nullable().optional(),
  mother_id: z.string().nullable().optional(),
  // 12. Raza sin porcentaje (con opción 'Sin raza')
  breed: z.string().default('Sin raza'),
  // 13. Activo o Inactivo
  status: z.enum(['Activo', 'Inactivo']).default('Activo'),
  inactivity_reason: z.string().nullable().optional(),
  // 14. Foto + Descripción (opcional)
  observations: z.string().nullable().optional(),
});

// Sub-componente para subir la foto
const SingleImageUploader = ({ preview, onCapture, onRemove, label }) => {
  const inputRef = useRef(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed border-neutral-300 rounded-3xl flex flex-col items-center justify-center text-neutral-400 bg-white hover:bg-neutral-50 cursor-pointer transition-all group overflow-hidden shadow-inner ${preview ? 'h-52' : 'h-36'}`}
    >
      {preview ? (
        <>
          <img src={preview} alt={label} className="w-full h-full object-cover animate-in fade-in zoom-in duration-300" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-3 right-3 bg-red-500 text-white p-2.5 rounded-full shadow-lg hover:bg-red-600 active:scale-90 transition-all z-10 cursor-pointer"
            title="Eliminar foto"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <Camera className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform text-[#1B4820]" strokeWidth={1.75} />
          <span className="text-xs font-black uppercase tracking-wider text-neutral-600">{label}</span>
          <span className="text-[10px] text-neutral-400 font-medium mt-0.5">Toca para tomar foto o seleccionar de galería</span>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onCapture} />
    </div>
  );
};

export default function AnimalForm({ initialValues, onSubmitSuccess, onCancel, onOpenModal, isModal = false }) {
  const navigate = useNavigate();

  // Estados de modales
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPotreroModalOpen, setIsPotreroModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);

  // Estado de imagen principal
  const initialMainPreview = useMemo(() => {
    if (initialValues?.photo_blob) {
      try {
        return URL.createObjectURL(initialValues.photo_blob);
      } catch (e) {
        return initialValues?.photo_path || null;
      }
    }
    return initialValues?.photo_path || null;
  }, [initialValues?.photo_blob, initialValues?.photo_path]);

  const [image, setImage] = useState({
    blob: null,
    preview: initialMainPreview,
    isModified: false
  });

  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  // Consultas reactivas Dexie
  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const owners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];

  const defaultValuesMapped = useMemo(() => {
    if (!initialValues) return {
      number: '',
      chip_number: '',
      name: '',
      sex: 'Hembra',
      birth_date: '',
      current_weight_kg: '',
      color: '',
      owner_id: '',
      farm_id: '',
      potrero_id: '',
      father_id: '',
      mother_id: '',
      breed: 'Sin raza',
      status: 'Activo',
      inactivity_reason: '',
      observations: ''
    };
    return {
      number: initialValues.number || '',
      chip_number: initialValues.chip_number || '',
      name: initialValues.name || '',
      sex: initialValues.sex || 'Hembra',
      birth_date: initialValues.birth_date || '',
      current_weight_kg: initialValues.last_weight_kg ?? '',
      color: initialValues.color || '',
      owner_id: initialValues.owner_id || '',
      farm_id: initialValues.farm_id || '',
      potrero_id: initialValues.potrero_id || '',
      father_id: initialValues.father_id || '',
      mother_id: initialValues.mother_id || '',
      breed: initialValues.breed || 'Sin raza',
      status: initialValues.status || 'Activo',
      inactivity_reason: initialValues.inactivity_reason || '',
      observations: initialValues.observations || ''
    };
  }, [initialValues]);

  const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(animalSchema),
    defaultValues: defaultValuesMapped
  });

  const selectedSex = watch('sex');
  const selectedStatus = watch('status');
  const fatherId = watch('father_id');
  const motherId = watch('mother_id');
  const selectedFarmId = watch('farm_id');
  const selectedOwnerId = watch('owner_id');
  const selectedPotreroId = watch('potrero_id');
  const selectedBreed = watch('breed');

  // Potreros reactivos de la finca actualmente seleccionada
  const potreros = useLiveQuery(
    () => selectedFarmId ? db.potreros.filter(p => p.farm_id === selectedFarmId && !p.deleted_at).toArray() : [],
    [selectedFarmId]
  ) || [];

  // Limpiar potrero si la finca cambia
  useEffect(() => {
    if (selectedFarmId && selectedPotreroId) {
      const existsInCurrentFarm = potreros.some(p => p.id === selectedPotreroId);
      if (!existsInCurrentFarm && potreros.length > 0) {
        setValue('potrero_id', '');
      }
    } else if (!selectedFarmId) {
      setValue('potrero_id', '');
    }
  }, [selectedFarmId, selectedPotreroId, potreros, setValue]);

  // Manejo de captura de foto
  const handleImageCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressedBlob = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressedBlob);
      setImage({ blob: compressedBlob, preview: previewUrl, isModified: true });
    } catch (error) {
      console.error('Error procesando imagen:', error);
      alert('Error al comprimir la foto.');
    }
  };

  const removeImage = () => {
    setImage({ blob: null, preview: null, isModified: true });
  };


  // Guardado de animal (Local-First puro)
  const handleSave = async (data) => {
    try {
      const userId = localStorage.getItem("ganadera_user_id");
      if (!userId) {
        alert('Sesión no encontrada. Por favor inicia sesión nuevamente.');
        navigate('/login');
        return;
      }

      const isEditing = !!initialValues?.id;
      const animalId = initialValues?.id || crypto.randomUUID();
      const now = new Date().toISOString();

      const photoBlobToSave = image.isModified
        ? (image.blob || null)
        : (isEditing ? (initialValues?.photo_blob || null) : null);

      const photoPathToSave = image.isModified
        ? null
        : (isEditing ? (initialValues?.photo_path || null) : null);

      let finalWeight = initialValues?.last_weight_kg || null;
      let finalWeightDate = initialValues?.last_weight_date || null;

      if (data.current_weight_kg !== undefined && data.current_weight_kg !== null && data.current_weight_kg !== '') {
        finalWeight = Number(data.current_weight_kg);
        finalWeightDate = now;
      }

      const animalData = {
        id: animalId,
        user_id: userId,
        number: data.number.trim(),
        chip_number: data.chip_number?.trim() || null,
        name: data.name?.trim() || null,
        sex: data.sex,
        birth_date: data.birth_date || null,
        color: data.color?.trim() || null,
        owner_id: data.owner_id || null,
        farm_id: data.farm_id || null,
        potrero_id: data.farm_id ? (data.potrero_id || null) : null,
        father_id: data.father_id || null,
        mother_id: data.mother_id || null,
        breed: data.breed?.trim() || 'Sin raza',
        status: data.status || 'Activo',
        inactivity_reason: data.status === 'Inactivo' ? (data.inactivity_reason?.trim() || 'Inactivo') : null,
        observations: data.observations?.trim() || null,
        photo_path: photoPathToSave,
        photo_blob: photoBlobToSave,
        last_weight_kg: finalWeight,
        last_weight_date: finalWeightDate,
        created_at: isEditing ? initialValues.created_at : now,
        updated_at: now,
        deleted_at: null
      };

      await db.transaction('rw', [db.animals, db.growth_events, db.sync_queue], async () => {
        if (isEditing) {
          await db.animals.put(animalData);
          await addToSyncQueue('animals', 'UPDATE', animalData);
        } else {
          await db.animals.add(animalData);
          await addToSyncQueue('animals', 'INSERT', animalData);
        }

        // Si se especificó fecha de nacimiento, reflejar o actualizar el evento 'Nacimiento' en growth_events
        if (data.birth_date) {
          const existingBirthEvent = await db.growth_events
            .where('animal_id')
            .equals(animalId)
            .and(e => !e.deleted_at && (e.event_type || '').toLowerCase().includes('nacimiento'))
            .first();

          if (existingBirthEvent) {
            const updatedBirthEvent = {
              ...existingBirthEvent,
              event_date: data.birth_date,
              weight_kg: finalWeight !== null && finalWeight !== undefined ? finalWeight : existingBirthEvent.weight_kg,
              updated_at: now
            };
            await db.growth_events.put(updatedBirthEvent);
            await addToSyncQueue('growth_events', 'UPDATE', updatedBirthEvent);
          } else {
            const newBirthEvent = {
              id: crypto.randomUUID(),
              user_id: userId,
              animal_id: animalId,
              event_type: 'Nacimiento',
              event_date: data.birth_date,
              weight_kg: finalWeight !== null && finalWeight !== undefined ? finalWeight : null,
              mother_weight_kg: null,
              scrotal_circumference_cm: null,
              navel_length: null,
              observations: 'Registro de nacimiento',
              photo_path: null,
              photo_blob: null,
              created_at: now,
              updated_at: now,
              deleted_at: null
            };
            await db.growth_events.add(newBirthEvent);
            await addToSyncQueue('growth_events', 'INSERT', newBirthEvent);
          }
        }
      });

      setToast({ 
        show: true, 
        type: 'success', 
        message: isEditing ? 'Animal actualizado exitosamente' : 'Animal registrado exitosamente' 
      });

      setTimeout(() => {
        if (onSubmitSuccess) {
          onSubmitSuccess(animalData);
        } else {
          navigate('/inventario');
        }
      }, 500);

    } catch (err) {
      console.error('Error al guardar animal:', err);
      setToast({ show: true, type: 'error', message: 'Error al guardar el animal.' });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    }
  };

  return (
    <div className={`relative ${isModal ? 'pb-0' : 'pb-28 sm:pb-24'}`}>
      {/* Toast Notificación */}
      {toast.show && (
        <div className={`fixed z-[100] px-5 py-3.5 rounded-2xl shadow-xl transition-all top-5 left-1/2 -translate-x-1/2 font-bold text-sm flex items-center gap-3 text-white ${
          toast.type === 'success' ? 'bg-[#1A3621]' : 'bg-red-600'
        }`}>
          <CheckCircle className="w-5 h-5" />
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit(handleSave)} className="space-y-6 max-w-4xl mx-auto" autoComplete="off" data-form-type="other">
        {/* Input señuelo oculto para absorber autocompletados no deseados de navegadores */}
        <input type="text" name="prevent_autofill" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" readOnly />

        {/* ========================================================================= */}
        {/* 1. NÚMERO DE ARETE & 2. NÚMERO DE CHIP & 3. NOMBRE (OPCIONAL)            */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1B4820] flex items-center justify-center">
              <IdCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">Identificación Básica</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Arete, chip electrónico y nombre</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Número de arete */}
            <div>
              <label className="text-[11px] font-black text-[#1B4820] uppercase tracking-wider mb-1.5 block">
                1. Número de Arete *
              </label>
              <Controller
                name="number"
                control={control}
                render={({ field }) => (
                  <input
                    type="text"
                    ref={field.ref}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    id="animal_tag_code"
                    name="animal_tag_code"
                    autoComplete="one-time-code"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    placeholder="Ej. 104, AR-001"
                    className={`w-full bg-neutral-50 border rounded-2xl px-4 py-3 text-sm font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all ${
                      errors.number ? 'border-red-400' : 'border-neutral-200'
                    }`}
                  />
                )}
              />
              {errors.number && <p className="text-[11px] text-red-500 font-semibold mt-1 ml-1">{errors.number.message}</p>}
            </div>

            {/* 2. Número de chip */}
            <div>
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                2. Número de Chip
              </label>
              <Controller
                name="chip_number"
                control={control}
                render={({ field }) => (
                  <input
                    type="text"
                    ref={field.ref}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    id="animal_rfid_identifier"
                    name="animal_rfid_identifier"
                    autoComplete="one-time-code"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    placeholder="Ej. 982000345678901"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all"
                  />
                )}
              />
            </div>

            {/* 3. Nombre (opcional) */}
            <div>
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-neutral-400" />
                3. Nombre (Opcional)
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <input
                    type="text"
                    ref={field.ref}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    id="animal_alias_text"
                    name="animal_alias_text"
                    autoComplete="one-time-code"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="words"
                    placeholder="Ej. Mariposa, Lucero"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all"
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. GÉNERO & 5. FECHA DE NACIMIENTO & 6. PESO & 7. COLOR                   */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
              <GiCow className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">Características Biológicas</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Género, nacimiento, peso y color</p>
            </div>
          </div>

          {/* 4. Género */}
          <div>
            <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-2 block">
              4. Género *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue('sex', 'Hembra')}
                className={`py-3.5 px-4 rounded-2xl border-2 flex items-center justify-center gap-2 font-black text-sm transition-all cursor-pointer ${
                  selectedSex === 'Hembra'
                    ? 'bg-pink-50 border-pink-500 text-pink-700 shadow-xs'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <FaVenus className="w-4 h-4" />
                <span>Hembra</span>
              </button>

              <button
                type="button"
                onClick={() => setValue('sex', 'Macho')}
                className={`py-3.5 px-4 rounded-2xl border-2 flex items-center justify-center gap-2 font-black text-sm transition-all cursor-pointer ${
                  selectedSex === 'Macho'
                    ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <FaMars className="w-4 h-4" />
                <span>Macho</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* 5. Fecha de nacimiento */}
            <div>
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                5. Fecha Nacimiento
              </label>
              <DateInput
                {...register('birth_date')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1B4820]/20"
              />
              {errors.birth_date && <p className="text-[11px] text-red-500 font-semibold mt-1 ml-1">{errors.birth_date.message}</p>}
            </div>

            {/* 6. Peso (opcional) */}
            <div>
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-neutral-400" />
                6. Peso (kg) (Opcional)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('current_weight_kg')}
                placeholder="Ej. 380"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20"
              />
            </div>

            {/* 7. Color (opcional) */}
            <div>
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-neutral-400" />
                7. Color (Opcional)
              </label>
              <input
                type="text"
                {...register('color')}
                placeholder="Ej. Blanco, Barroso, Negro"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 8. DUEÑO & 9. FINCA & 10. POTRERO                                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">Ubicación y Propiedad</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Dueño, finca y potrero asignado</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 8. Dueño */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-neutral-400" />
                  8. Dueño
                </label>
                <button
                  type="button"
                  onClick={() => setIsOwnerModalOpen(true)}
                  className="text-[11px] font-bold text-[#1B4820] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nuevo</span>
                </button>
              </div>

              <CustomSelect
                value={selectedOwnerId}
                onChange={(val) => setValue('owner_id', val)}
                options={[
                  { value: '', label: 'Sin dueño asignado' },
                  ...owners.map(o => ({ value: o.id, label: o.name }))
                ]}
                placeholder="Selecciona el dueño..."
              />
            </div>

            {/* 9. Finca */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                  9. Finca
                </label>
                <button
                  type="button"
                  onClick={() => setIsFarmModalOpen(true)}
                  className="text-[11px] font-bold text-[#1B4820] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Fincas</span>
                </button>
              </div>

              <CustomSelect
                value={selectedFarmId}
                onChange={(val) => setValue('farm_id', val)}
                options={[
                  { value: '', label: 'Sin finca asignada' },
                  ...farms.map(f => ({ value: f.id, label: `${f.name}${f.location ? ` (${f.location})` : ''}` }))
                ]}
                placeholder="Selecciona la finca..."
              />
            </div>

            {/* 10. Potrero (si se escoge finca se puede seleccionar potrero) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  selectedFarmId ? 'text-neutral-700' : 'text-neutral-400'
                }`}>
                  10. Potrero
                </label>
                {selectedFarmId && (
                  <button
                    type="button"
                    onClick={() => setIsPotreroModalOpen(true)}
                    className="text-[11px] font-bold text-[#1B4820] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nuevo</span>
                  </button>
                )}
              </div>

              {selectedFarmId ? (
                <CustomSelect
                  value={selectedPotreroId}
                  onChange={(val) => setValue('potrero_id', val)}
                  options={[
                    { value: '', label: 'Sin potrero asignado' },
                    ...potreros.map(p => ({ value: p.id, label: p.name }))
                  ]}
                  placeholder={potreros.length === 0 ? "Sin potreros (crea uno)" : "Selecciona potrero..."}
                />
              ) : (
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/70 text-xs text-neutral-400 font-medium italic">
                  Selecciona una finca primero para asignar un potrero.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 11. MADRE Y PADRE                                                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <GiCow className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">11. Madre y Padre (Genealogía)</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Línea ascendente directa</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <GenealogySelector 
                label="Padre (Toro)" 
                sex="Macho" 
                value={fatherId} 
                onChange={(id) => setValue('father_id', id)} 
                onCreateNew={(sex) => onOpenModal && onOpenModal(sex, (id) => setValue('father_id', id))} 
              />
            </div>

            <div>
              <GenealogySelector 
                label="Madre (Vaca)" 
                sex="Hembra" 
                value={motherId} 
                onChange={(id) => setValue('mother_id', id)} 
                onCreateNew={(sex) => onOpenModal && onOpenModal(sex, (id) => setValue('mother_id', id))} 
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 12. RAZA SIN PORCENTAJE (CON OPCIÓN 'SIN RAZA')                           */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Dna className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">12. Raza</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Clasificación racial (con opción 'Sin raza')</p>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-2 block">
              Seleccionar Raza
            </label>
            <CustomSelect
              value={selectedBreed}
              onChange={(val) => setValue('breed', val)}
              options={POPULAR_BREEDS_LIST.map(b => ({ value: b, label: b }))}
              placeholder="Selecciona la raza..."
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 13. ACTIVO O INACTIVO                                                     */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">13. Estado del Animal</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Activo en inventario o dado de baja</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setValue('status', 'Activo')}
              className={`py-3.5 px-4 rounded-2xl border-2 font-black text-sm transition-all cursor-pointer ${
                selectedStatus === 'Activo'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-xs'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Activo
            </button>

            <button
              type="button"
              onClick={() => setValue('status', 'Inactivo')}
              className={`py-3.5 px-4 rounded-2xl border-2 font-black text-sm transition-all cursor-pointer ${
                selectedStatus === 'Inactivo'
                  ? 'bg-neutral-800 border-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Inactivo (Baja)
            </button>
          </div>

          {selectedStatus === 'Inactivo' && (
            <div className="pt-2 animate-in fade-in">
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 block">
                Motivo de la Baja
              </label>
              <input
                type="text"
                {...register('inactivity_reason')}
                placeholder="Ej. Vendido a Hacienda El Paraíso, Fallecimiento por causa natural..."
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20"
              />
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 14. FOTO + DESCRIPCIÓN (OPCIONAL)                                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1B4820] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">14. Foto y Descripción (Opcional)</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Fotografía del animal y notas adicionales</p>
            </div>
          </div>

          <SingleImageUploader
            preview={image.preview}
            onCapture={handleImageCapture}
            onRemove={removeImage}
            label="Foto del Animal"
          />

          <div>
            <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mb-1.5 block">
              Descripción / Observaciones
            </label>
            <textarea
              {...register('observations')}
              rows={3}
              placeholder="Detalles particulares, señas, marcas o cualquier observación relevante..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-sm font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all resize-none"
            />
          </div>
        </div>

        {/* BOTONES DE ACCIÓN FIJADOS AL FONDO */}
        <div
          className={`${
            isModal
              ? 'sticky bottom-0 -mx-6 px-6 py-3.5 mt-6 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] z-30'
              : 'fixed bottom-0 inset-x-0 py-3.5 px-4 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] z-30'
          }`}
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 active:scale-[0.99] text-neutral-700 text-sm font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#1B4820] hover:bg-[#0F2912] active:scale-[0.99] text-white text-sm font-bold py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{initialValues?.id ? 'Guardar Cambios' : 'Registrar Animal'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Fincas */}
      <FarmModal
        isOpen={isFarmModalOpen}
        onClose={() => setIsFarmModalOpen(false)}
        onFarmCreated={(newFarm) => {
          if (newFarm?.id) {
            setValue('farm_id', newFarm.id);
          }
        }}
      />

      {/* Modal de Potreros */}
      <PotreroModal
        isOpen={isPotreroModalOpen}
        onClose={() => setIsPotreroModalOpen(false)}
        defaultFarmId={selectedFarmId}
        onPotreroCreated={(newPot) => {
          if (newPot?.id) {
            setValue('potrero_id', newPot.id);
          }
        }}
      />

      {/* Modal de Dueños */}
      <OwnerModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        onOwnerCreated={(newOwner) => {
          if (newOwner?.id) {
            setValue('owner_id', newOwner.id);
          }
        }}
      />
    </div>
  );
}