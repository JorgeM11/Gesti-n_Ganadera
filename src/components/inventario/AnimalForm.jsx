import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Save, X, ChevronUp, ChevronDown, Trash2, Plus, 
  CheckCircle, TriangleAlert, Building2, Sparkles, Dna, 
  Milk, Scale, Info 
} from 'lucide-react';
import { GiCow } from 'react-icons/gi';
import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '@/lib/db';
import { addToSyncQueue, runFullSync } from '@/lib/syncUtils';
import { compressImage } from '@/lib/imageUtils';
import { calculateOffspringGenetics, POPULAR_BREEDS } from '@/lib/geneticsUtils';
import GenealogySelector from './GenealogySelector';
import FarmModal from './FarmModal';
import CustomSelect from '@/components/ui/CustomSelect';
import { useNavigate } from 'react-router-dom';
import { formatShortDateLocal } from '@/lib/dateUtils';
import { DateInput } from '@/components/ui/DateInput';

// Esquema de validación con Zod
const animalSchema = z.object({
  number: z.string().min(1, 'El código es obligatorio'),
  sex: z.enum(['Macho', 'Hembra']),
  color: z.string().nullable().optional(),
  origin_service_id: z.string().nullable().optional(),

  // Finca y Genética
  farm_id: z.string().nullable().optional(),
  breed: z.string().default('Mestizo'),
  purity_percentage: z.preprocess((val) => (val === '' || val === null) ? 50 : Number(val), z.number().min(0).max(100).default(50)),
  breed_composition: z.any().optional(),

  birth_date: z.string().nullable().optional().refine(val => !val || new Date(val) <= new Date(), { message: 'La fecha no puede ser futura' }),
  birth_weight_kg: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  mother_weight_at_birth: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  navel_length: z.string()
    .refine(val => !val || /^[1-9]$/.test(val), { message: 'Debe ser del 1 al 9' })
    .nullable()
    .optional(),
  birth_observations: z.string().nullable().optional(),

  weaning_date: z.string().nullable().optional().refine(val => !val || new Date(val) <= new Date(), { message: 'La fecha no puede ser futura' }),
  weaning_weight_kg: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  mother_weight_at_weaning: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  sc_at_weaning: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  weaning_observations: z.string().nullable().optional(),

  father_id: z.string().nullable().optional(),
  mother_id: z.string().nullable().optional(),

  current_weight_kg: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  current_sc_cm: z.preprocess((val) => (val === '' || val === null) ? undefined : Number(val), z.number().optional()),
  observations: z.string().nullable().optional(),
  status: z.enum(['Activo', 'Inactivo']).default('Activo'),
  inactivity_reason: z.string().nullable().optional(),
});

// --- SUB-COMPONENTE REUTILIZABLE PARA IMÁGENES ---
const ImageUploader = ({ preview, onCapture, onRemove, label, id }) => {
  const inputRef = useRef(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed border-neutral-300 rounded-2xl flex flex-col items-center justify-center text-neutral-400 bg-white/50 hover:bg-white cursor-pointer transition-all group overflow-hidden shadow-inner ${preview ? 'h-48' : 'h-32'}`}
    >
      {preview ? (
        <>
          <img src={preview} alt={label} className="w-full h-full object-cover animate-in fade-in zoom-in duration-300" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-3 right-3 bg-red-500 text-white p-2.5 rounded-full shadow-lg hover:bg-red-600 active:scale-90 transition-all z-10 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <Camera className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform text-neutral-500" strokeWidth={1.5} />
          <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">{label}</span>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onCapture} />
    </div>
  );
};

export default function AnimalForm({ initialValues, onSubmitSuccess, onCancel, onOpenModal, isModal = false }) {
  const navigate = useNavigate();
  const [activeAccordions, setActiveAccordions] = useState({ birth: false, weaning: false, service: false });
  const [eventIds, setEventIds] = useState({ birth: null, weaning: null });

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

  const [images, setImages] = useState({
    main: { blob: null, preview: initialMainPreview, isModified: false },
    birth: { blob: null, preview: null, isModified: false },
    weaning: { blob: null, preview: null, isModified: false }
  });

  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  const existingEventPhotos = useRef({
    birth: { blob: null, path: null },
    weaning: { blob: null, path: null }
  });

  const [showQuickService, setShowQuickService] = useState(false);
  const [isSavingQuickService, setIsSavingQuickService] = useState(false);
  const [quickServiceData, setQuickServiceData] = useState({ date: '', type: 'Monta Natural' });

  // --- FINCAS & GENÉTICA ---
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [geneticSuggestion, setGeneticSuggestion] = useState(null);

  const farms = useLiveQuery(
    () => db.farms.filter(f => !f.deleted_at).toArray()
  ) || [];

  const defaultValuesMapped = useMemo(() => {
    if (!initialValues) return {
      sex: 'Macho',
      status: 'Activo',
      breed: 'Mestizo',
      purity_percentage: 50,
      farm_id: '',
      breed_composition: null
    };
    return {
      ...initialValues,
      farm_id: initialValues.farm_id || '',
      breed: initialValues.breed || 'Mestizo',
      purity_percentage: initialValues.purity_percentage ?? 50,
      breed_composition: initialValues.breed_composition || null,
      current_weight_kg: initialValues.last_weight_kg,
      navel_length: initialValues.navel_length ? String(initialValues.navel_length) : '',
    };
  }, [initialValues]);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting, dirtyFields } } = useForm({
    resolver: zodResolver(animalSchema),
    defaultValues: defaultValuesMapped
  });

  const selectedSex = watch('sex');
  const selectedStatus = watch('status');
  const fatherId = watch('father_id');
  const motherId = watch('mother_id');
  const selectedFarmId = watch('farm_id');
  const selectedBreed = watch('breed');
  const selectedPurity = watch('purity_percentage');
  const breedComposition = watch('breed_composition');

  const birthDate = watch('birth_date');
  const birthWeight = watch('birth_weight_kg');
  const navelLength = watch('navel_length');
  const weaningDate = watch('weaning_date');
  const weaningWeight = watch('weaning_weight_kg');
  const originServiceId = watch('origin_service_id');

  const hasBirthData = Boolean(birthDate || birthWeight || navelLength || images.birth.preview);
  const hasWeaningData = Boolean(weaningDate || weaningWeight || images.weaning.preview);
  const hasServiceData = Boolean(originServiceId);

  // Cálculo genético automático al cambiar de padres
  useEffect(() => {
    const computeGenetics = async () => {
      if (!fatherId && !motherId) {
        setGeneticSuggestion(null);
        return;
      }
      const father = fatherId ? await db.animals.get(fatherId) : null;
      const mother = motherId ? await db.animals.get(motherId) : null;

      if (!father && !mother) {
        setGeneticSuggestion(null);
        return;
      }

      const calculated = calculateOffspringGenetics(father, mother);

      // Si es animal nuevo y no tiene raza fija modificada por el usuario, auto-asignar
      if (!initialValues?.id) {
        if (!dirtyFields.breed) {
          setValue('breed', calculated.breed, { shouldDirty: false });
          setValue('purity_percentage', calculated.purity_percentage, { shouldDirty: false });
          setValue('breed_composition', calculated.breed_composition, { shouldDirty: false });
          setGeneticSuggestion(null);
          return;
        }
      }

      // Comprobar si la genética calculada YA coincide con la actual del formulario
      const currentBreed = selectedBreed || 'Mestizo';
      const isSameBreed = currentBreed === calculated.breed;
      let isSameGenetics = false;

      if (isSameBreed) {
        if (calculated.breed !== 'Mestizo') {
          const p1 = Math.round(Number(selectedPurity ?? 100));
          const p2 = Math.round(Number(calculated.purity_percentage ?? 100));
          isSameGenetics = Math.abs(p1 - p2) <= 1;
        } else {
          const comp1 = breedComposition || {};
          const comp2 = calculated.breed_composition || {};
          const keys1 = Object.keys(comp1).filter(k => Number(comp1[k]) > 0);
          const keys2 = Object.keys(comp2).filter(k => Number(comp2[k]) > 0);
          isSameGenetics = keys1.length === keys2.length && 
            keys1.every(k => Math.round(Number(comp1[k])) === Math.round(Number(comp2[k])));
        }
      }

      // Si ya está aplicada, nunca mostrar la recomendación
      if (isSameGenetics) {
        setGeneticSuggestion(null);
        return;
      }

      // En modo edición: si los padres son los que ya tenía el animal y no han cambiado en esta sesión
      const isOriginalParents = Boolean(
        initialValues?.id && 
        fatherId === (initialValues.father_id || null) && 
        motherId === (initialValues.mother_id || null)
      );

      if (isOriginalParents) {
        setGeneticSuggestion(null);
        return;
      }

      // Solo sugerir si los padres fueron cambiados y difiere de lo actual
      setGeneticSuggestion(calculated);
    };
    computeGenetics();
  }, [fatherId, motherId, initialValues, selectedBreed, selectedPurity, breedComposition, setValue, dirtyFields]);

  const handleApplySuggestion = () => {
    if (!geneticSuggestion) return;
    setValue('breed', geneticSuggestion.breed, { shouldDirty: true });
    setValue('purity_percentage', geneticSuggestion.purity_percentage, { shouldDirty: true });
    setValue('breed_composition', geneticSuggestion.breed_composition, { shouldDirty: true });
    setGeneticSuggestion(null); // Desaparece inmediatamente la recomendación
  };

  // Si el animal es hembra, limpiar circunferencia escrotal al destete
  useEffect(() => {
    if (selectedSex === 'Hembra') {
      setValue('sc_at_weaning', null);
    }
  }, [selectedSex, setValue]);

  // --- CARGA DE DATOS AL EDITAR (FASE 3 & MEMORIA) ---
  useEffect(() => {
    const loadExistingEvents = async () => {
      if (!initialValues?.id) return;
      const events = await db.growth_events.where('animal_id').equals(initialValues.id).toArray();
      const birth = events.find(e => e.event_type === 'Nacimiento');
      const weaning = events.find(e => e.event_type === 'Destete');

      // Imagen Principal
      if (initialValues.photo_blob) {
        try {
          const url = URL.createObjectURL(initialValues.photo_blob);
          setImages(prev => {
            if (prev.main.isModified) return prev;
            return { ...prev, main: { ...prev.main, preview: url } };
          });
        } catch (e) {
          // ignore
        }
      }

      if (birth) {
        setEventIds(prev => ({ ...prev, birth: birth.id }));
        setValue('birth_date', birth.event_date);
        setValue('birth_weight_kg', birth.weight_kg);
        setValue('mother_weight_at_birth', birth.mother_weight_kg);
        setValue('navel_length', birth.navel_length ? String(birth.navel_length) : '');
        setValue('birth_observations', birth.observations);
        
        // Priorizar BLOB local para previsualización en edición
        let birthPreview = birth.photo_path;
        if (birth.photo_blob) {
          birthPreview = URL.createObjectURL(birth.photo_blob);
        }
        setImages(prev => ({ ...prev, birth: { ...prev.birth, preview: birthPreview } }));
        existingEventPhotos.current.birth = { blob: birth.photo_blob || null, path: birth.photo_path || null };
      }

      if (weaning) {
        setEventIds(prev => ({ ...prev, weaning: weaning.id }));
        setValue('weaning_date', weaning.event_date);
        setValue('weaning_weight_kg', weaning.weight_kg);
        setValue('mother_weight_at_weaning', weaning.mother_weight_kg);
        setValue('sc_at_weaning', weaning.scrotal_circumference_cm);
        setValue('weaning_observations', weaning.observations);

        // Priorizar BLOB local
        let weaningPreview = weaning.photo_path;
        if (weaning.photo_blob) {
          weaningPreview = URL.createObjectURL(weaning.photo_blob);
        }
        setImages(prev => ({ ...prev, weaning: { ...prev.weaning, preview: weaningPreview } }));
        existingEventPhotos.current.weaning = { blob: weaning.photo_blob || null, path: weaning.photo_path || null };
      }
    };
    loadExistingEvents();

    // Limpieza de memoria: Revocamos los ObjectURLs al desmontar
    return () => {
      setImages(prev => {
        if (prev.main.preview?.startsWith('blob:')) URL.revokeObjectURL(prev.main.preview);
        if (prev.birth.preview?.startsWith('blob:')) URL.revokeObjectURL(prev.birth.preview);
        if (prev.weaning.preview?.startsWith('blob:')) URL.revokeObjectURL(prev.weaning.preview);
        return prev;
      });
    };
  }, [initialValues, setValue]);

  const motherServices = useLiveQuery(
    async () => {
      if (!motherId) return [];
      const services = await db.services.where('mother_id').equals(motherId).toArray();
      const validServices = services.filter(s => !s.deleted_at);

      const fatherIds = validServices.map(s => s.father_id).filter(Boolean);
      const fathers = fatherIds.length > 0 ? await db.animals.where('id').anyOf(fatherIds).toArray() : [];

      const fatherMap = {};
      fathers.forEach(f => { fatherMap[f.id] = f.number; });

      return validServices.map(service => ({
        ...service,
        father_number: service.father_id ? (fatherMap[service.father_id] || null) : null
      }));
    },
    [motherId]
  );

  const toggleAccordion = (section) => {
    setActiveAccordions(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const motherServicesOptions = useMemo(() => {
    if (!motherServices) return [];
    return motherServices.map(s => {
      let toroInfo = '';
      if (s.father_number) {
        toroInfo = ` (Toro: #${s.father_number})`;
      } else if (s.father_id) {
        if (s.father_id.includes('-') && s.father_id.length > 20) {
          toroInfo = ` (Toro: Desconocido/Eliminado)`;
        } else {
          toroInfo = ` (Toro: ${s.father_id})`;
        }
      } else {
        toroInfo = ` (Sin Toro)`;
      }
      return {
        value: s.id,
        label: `${formatShortDateLocal(s.service_date)} - ${s.type_conception}${toroInfo}`
      };
    });
  }, [motherServices]);

  const serviceTypeOptions = [
    { value: 'Monta Natural', label: 'Monta Natural' },
    { value: 'Inseminación Artificial', label: 'Inseminación Artificial' },
  ];

  const handleImageCapture = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressedBlob = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressedBlob);
      setImages(prev => ({ 
        ...prev, 
        [type]: { blob: compressedBlob, preview: previewUrl, isModified: true } 
      }));
    } catch (error) {
      console.error('Error procesando imagen:', error);
      alert('Error al comprimir la foto.');
    }
  };

  const removeImage = (type) => {
    setImages(prev => ({ ...prev, [type]: { blob: null, preview: null, isModified: true } }));
  };

  // --- LÓGICA LOCAL-FIRST (Fase 2) ---
  const getLocalUserId = () => {
    return localStorage.getItem("ganadera_user_id");
  };

  const handleQuickServiceCreate = async () => {
    if (!quickServiceData.date) return alert('Selecciona una fecha para el servicio');
    if (isSavingQuickService) return;

    setIsSavingQuickService(true);

    try {
      const userId = getLocalUserId();

      if (!userId) {
        setToast({ show: true, type: 'error', message: 'Sesión expirada. Conéctate a internet.' });
        navigate('/login');
        return;
      }

      const newService = {
        id: crypto.randomUUID(),
        user_id: userId,
        mother_id: motherId,
        father_id: fatherId || null,
        type_conception: quickServiceData.type,
        service_date: quickServiceData.date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.transaction('rw', [db.services, db.sync_queue], async () => {
        await db.services.add(newService);
        await addToSyncQueue('services', 'INSERT', newService);
      });

      setToast({ show: true, type: 'success', message: 'Servicio registrado correctamente' });

      setTimeout(() => {
        setToast({ show: false, type: 'success', message: '' });
        setValue('origin_service_id', newService.id);
        setShowQuickService(false);
      }, 500);

    } catch (err) {
      console.error('Error creando servicio rápido', err);
      setToast({ show: true, type: 'error', message: 'Fallo al registrar servicio' });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    } finally {
      setIsSavingQuickService(false);
    }
  };

  const handleSave = async (data) => {
    try {
      const userId = getLocalUserId();

      if (!userId) {
        alert('Sesión expirada. Por favor, conéctate a internet e inicia sesión nuevamente.');
        navigate('/login');
        return;
      }

      const isEditing = !!initialValues?.id;
      const animalId = initialValues?.id || crypto.randomUUID();
      const now = new Date().toISOString();

      // Si ha sido modificado, el photo_path debe ser null para que el proceso de sincronización 
      // lo detecte como algo nuevo que debe subir (o para eliminarlo si es null).
      const photoBlobToSave = images.main.isModified
        ? (images.main.blob || null)
        : (isEditing ? (initialValues?.photo_blob || null) : null);

      const photoPathToSave = images.main.isModified
        ? null
        : (isEditing ? (initialValues?.photo_path || null) : null);

      const birthImg = {
        blob: images.birth.isModified ? (images.birth.blob || null) : existingEventPhotos.current.birth.blob,
        url: images.birth.isModified ? null : existingEventPhotos.current.birth.path
      };

      const weaningImg = {
        blob: images.weaning.isModified ? (images.weaning.blob || null) : existingEventPhotos.current.weaning.blob,
        url: images.weaning.isModified ? null : existingEventPhotos.current.weaning.path
      };

      await db.transaction('rw', [db.animals, db.growth_events, db.sync_queue], async () => {
        // --- AISLAMIENTO DEL PESO ACTUAL ---
        let finalWeight = initialValues?.last_weight_kg || null;
        let finalWeightDate = initialValues?.last_weight_date || null;

        if (isEditing) {
          if (dirtyFields.current_weight_kg) {
            finalWeight = data.current_weight_kg;
            finalWeightDate = now;
          }
        } else {
           finalWeight = data.current_weight_kg || data.weaning_weight_kg || data.birth_weight_kg || null;
           finalWeightDate = data.current_weight_kg ? now : (data.weaning_weight_kg ? data.weaning_date : (data.birth_weight_kg ? data.birth_date : null));
        }

        const animalData = {
          id: animalId,
          user_id: userId,
          farm_id: data.farm_id || null,
          number: data.number,
          sex: data.sex,
          status: data.status || 'Activo',
          inactivity_reason: data.status === 'Inactivo' ? (data.inactivity_reason || 'No se especificó una razón para la baja del animal.') : null,
          color: data.color || null,
          breed: data.breed || 'Mestizo',
          purity_percentage: Number(data.purity_percentage ?? 50),
          breed_composition: data.breed_composition || null,
          birth_date: data.birth_date || null,
          mother_id: data.mother_id || null,
          father_id: data.father_id || null,
          origin_service_id: data.origin_service_id || null,
          observations: data.observations || null,
          photo_path: photoPathToSave,
          photo_blob: photoBlobToSave,
          last_weight_kg: finalWeight,
          last_weight_date: finalWeightDate,
          created_at: isEditing ? initialValues.created_at : now,
          updated_at: now,
          deleted_at: null
        };

        const syncOps = [];

        if (isEditing) {
          await db.animals.put(animalData);
          syncOps.push({ table_name: 'animals', operation: 'UPDATE', payload: animalData, created_at: now, status: 'PENDING' });
        } else {
          await db.animals.add(animalData);
          syncOps.push({ table_name: 'animals', operation: 'INSERT', payload: animalData, created_at: now, status: 'PENDING' });
        }

        if (data.birth_date) {
          const birthEvent = {
            id: eventIds.birth || crypto.randomUUID(),
            user_id: userId,
            animal_id: animalId,
            event_type: 'Nacimiento',
            event_date: data.birth_date,
            weight_kg: data.birth_weight_kg || null,
            mother_weight_kg: data.mother_weight_at_birth || null,
            navel_length: data.navel_length || null,
            observations: data.birth_observations || null,
            photo_path: birthImg.url,
            photo_blob: birthImg.blob,
            created_at: eventIds.birth ? undefined : now,
            updated_at: now
          };
          await db.growth_events.put(birthEvent);
          syncOps.push({ table_name: 'growth_events', operation: eventIds.birth ? 'UPDATE' : 'INSERT', payload: birthEvent, created_at: now, status: 'PENDING' });
        }

        if (data.weaning_date) {
          const weaningEvent = {
            id: eventIds.weaning || crypto.randomUUID(),
            user_id: userId,
            animal_id: animalId,
            event_type: 'Destete',
            event_date: data.weaning_date,
            weight_kg: data.weaning_weight_kg || null,
            mother_weight_kg: data.mother_weight_at_weaning || null,
            scrotal_circumference_cm: data.sex === 'Hembra' ? null : (data.sc_at_weaning || null),
            observations: data.weaning_observations || null,
            photo_path: weaningImg.url,
            photo_blob: weaningImg.blob,
            created_at: eventIds.weaning ? undefined : now,
            updated_at: now
          };
          await db.growth_events.put(weaningEvent);
          syncOps.push({ table_name: 'growth_events', operation: eventIds.weaning ? 'UPDATE' : 'INSERT', payload: weaningEvent, created_at: now, status: 'PENDING' });
        }

        // Insertar a la cola en bloque dentro del contexto transaccional
        await db.sync_queue.bulkAdd(syncOps);
      });

      // Fuera de la transacción invocar el engine
      if (navigator.onLine) {
        setTimeout(runFullSync, 500);
      }

      setToast({
        show: true,
        type: 'success',
        message: isEditing ? 'Cambios guardados exitosamente' : 'Animal registrado con éxito'
      });

      setTimeout(() => {
        setToast({ show: false, type: 'success', message: '' });
        onSubmitSuccess && onSubmitSuccess(animalId);
      }, 500);

    } catch (err) {
      console.error('Error guardando animal:', err);
      setToast({ show: true, type: 'error', message: 'Error al procesar la información' });
      setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(handleSave)} className="pb-10">
      {toast.show && (
        <div className={`fixed z-[100] px-5 py-4 ${toast.type === 'success' ? 'bg-[#1A3621]' : 'bg-red-900'} text-white rounded-2xl shadow-2xl transition-all animate-in fade-in slide-in-from-top-5 top-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:-translate-x-0 font-bold text-sm flex items-center gap-3 w-[85%] max-w-sm sm:w-auto`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          ) : (
            <TriangleAlert className="w-6 h-6 text-red-400" />
          )}
          {toast.message}
        </div>
      )}

      {/* 0. IDENTIFICACIÓN VISUAL */}
      <section className="bg-[#F4F5F0] rounded-3xl p-5 mb-4 shadow-sm border border-neutral-100/50">
        <div className="mb-5">
          <ImageUploader id="main" label="Foto del Animal" preview={images.main.preview} onCapture={(e) => handleImageCapture(e, 'main')} onRemove={() => removeImage('main')} />
        </div>
        <div>
          <label className="text-sm font-bold text-[#1B4820] mb-2 block">Descripción del ganadero</label>
          <textarea {...register('observations')} placeholder="Añade una descripción visual del animal..." rows={3} className="w-full bg-white rounded-2xl px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#1B4820]/20 border border-transparent focus:border-[#1B4820]/30 transition-all shadow-sm resize-none" />
        </div>
      </section>

      {/* 1. IDENTIFICACIÓN BÁSICA Y FINCA */}
      <section className="bg-neutral-50 rounded-3xl p-5 mb-4 border border-neutral-100 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Identificación Básica</h3>

        {/* FINCA */}
        <div>
          <div className="flex items-center justify-between mb-1 ml-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#1B4820]" />
              Finca Asignada
            </label>
            <button
              type="button"
              onClick={() => setIsFarmModalOpen(true)}
              className="text-[10px] font-bold text-[#1B4820] hover:underline cursor-pointer flex items-center gap-1"
            >
              + Nueva Finca
            </button>
          </div>
          <CustomSelect
            value={selectedFarmId || ''}
            onChange={(val) => setValue('farm_id', val || null)}
            options={[
              { value: '', label: '— Sin finca asignada —' },
              ...farms.map(f => ({ value: f.id, label: `${f.name}${f.location ? ` (${f.location})` : ''}` }))
            ]}
            bgClass="bg-white"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Código / Número *</label>
          <input {...register('number')} placeholder="Ej: 1234" className={`w-full bg-white rounded-xl px-4 py-3 text-neutral-800 placeholder-neutral-400 border transition-all focus:outline-none focus:ring-2 focus:ring-[#1B4820]/20 ${errors.number ? 'border-red-500' : 'border-neutral-100 focus:border-[#1B4820]/30'}`} />
          {errors.number && <p className="text-red-500 text-[10px] mt-1 ml-1">{errors.number.message}</p>}
        </div>

        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Sexo del Animal</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setValue('sex', 'Macho')} className={`py-3 rounded-xl font-bold text-sm transition-all border cursor-pointer ${selectedSex === 'Macho' ? 'bg-[#1B4820] text-white border-[#1B4820]' : 'bg-white text-neutral-500 border-neutral-100'}`}>MACHO</button>
            <button type="button" onClick={() => setValue('sex', 'Hembra')} className={`py-3 rounded-xl font-bold text-sm transition-all border cursor-pointer ${selectedSex === 'Hembra' ? 'bg-[#1B4820] text-white border-[#1B4820]' : 'bg-white text-neutral-500 border-neutral-100'}`}>HEMBRA</button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Color del Animal</label>
          <input {...register('color')} placeholder="Ej: Rojo Suave" className="w-full bg-white rounded-xl px-4 py-3 text-neutral-800 placeholder-neutral-400 border border-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#1B4820]/20" />
        </div>
      </section>

      {/* 2. GENEALOGÍA */}
      <section className="bg-neutral-100/60 rounded-3xl p-5 mb-4 border border-neutral-200/70 shadow-2xs space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1.5 h-6 rounded-full bg-[#8C6746]"></div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1B4820]">Genealogía</h3>
            <p className="text-[11px] text-neutral-400 font-medium">Selección de progenitores (Padre y Madre)</p>
          </div>
        </div>

        <div>
          <GenealogySelector label="Padre (Toro)" sex="Macho" value={fatherId} onChange={(id) => setValue('father_id', id)} onCreateNew={(sex) => onOpenModal && onOpenModal(sex, (id) => setValue('father_id', id))} />
        </div>

        <div>
          <GenealogySelector label="Madre (Vaca)" sex="Hembra" value={motherId} onChange={(id) => setValue('mother_id', id)} onCreateNew={(sex) => onOpenModal && onOpenModal(sex, (id) => setValue('mother_id', id))} />
        </div>
      </section>

      {/* ACORDEÓN: SERVICIO DE ORIGEN */}
      {motherId && (
        <div className="bg-neutral-50 rounded-3xl p-5 mb-4 border border-neutral-200/70 shadow-2xs">
          <div 
            className="flex items-center justify-between cursor-pointer select-none" 
            onClick={() => toggleAccordion('service')}
          >
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 rounded-full bg-blue-500"></div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#1B4820]">Servicio de Origen</h3>
                <p className="text-[11px] text-neutral-400 font-medium">Inseminación o monta de la madre</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                hasServiceData 
                  ? 'bg-blue-100 text-blue-800 font-black' 
                  : 'bg-neutral-200/70 text-neutral-500'
              }`}>
                {hasServiceData ? 'Asignado' : 'Opcional'}
              </span>
              <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${activeAccordions.service ? 'rotate-180 text-[#1B4820]' : ''}`} />
            </div>
          </div>

          <AnimatePresence>
            {activeAccordions.service && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-5 space-y-4">
                  {motherServices === undefined ? (
                    <p className="text-sm text-neutral-500">Cargando servicios...</p>
                  ) : showQuickService ? (
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-[#1B4820] tracking-widest border-b border-neutral-100 pb-2">Nuevo Servicio Rápido</h4>

                      <div>
                        <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Fecha del Servicio</label>
                        <DateInput value={quickServiceData.date} onChange={e => setQuickServiceData(d => ({ ...d, date: e.target.value }))} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Tipo de Concepción</label>
                        <CustomSelect
                          value={quickServiceData.type}
                          onChange={val => setQuickServiceData(d => ({ ...d, type: val }))}
                          options={serviceTypeOptions}
                          bgClass="bg-neutral-50"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button type="button" disabled={isSavingQuickService} onClick={() => setShowQuickService(false)} className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-bold py-3.5 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">Cancelar</button>
                        <button type="button" disabled={isSavingQuickService} onClick={handleQuickServiceCreate} className="flex-1 bg-[#1B4820] hover:bg-[#0F2912] text-white text-xs font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2">
                          {isSavingQuickService ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              GUARDANDO...
                            </>
                          ) : 'Guardar y Usar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {motherServices.length === 0 ? (
                        <div className="text-center bg-white border border-neutral-100 p-4 rounded-2xl">
                          <p className="text-xs text-neutral-500 mb-2 font-medium">Esta madre no tiene servicios registrados.</p>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Seleccionar Servicio</label>
                          <CustomSelect
                            value={originServiceId}
                            onChange={val => setValue('origin_service_id', val)}
                            options={motherServicesOptions}
                            placeholder="Selecciona el servicio origen..."
                          />
                        </div>
                      )}

                      <button type="button" onClick={() => setShowQuickService(true)} className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-neutral-300 hover:border-[#1B4820] hover:text-[#1B4820] hover:bg-emerald-50 text-neutral-700 font-bold py-3.5 rounded-xl transition-all text-xs cursor-pointer shadow-2xs">
                        <Plus className="w-4 h-4 text-[#1B4820]" />
                        REGISTRAR NUEVO SERVICIO
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 3. RAZA Y CARACTERÍSTICAS GENÉTICAS (DEBAJO DE GENEALOGÍA) */}
      <section className="bg-amber-50/40 rounded-3xl p-5 mb-4 border border-amber-200/60 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-6 rounded-full bg-amber-600"></div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-1.5">
              <Dna className="w-4 h-4 text-amber-600" />
              Raza y Genética
            </h3>
            <p className="text-[11px] text-neutral-500 font-medium">Clasificación racial y pureza</p>
          </div>
        </div>

        {/* Banner de sugerencia genética automática con AnimatePresence (Desaparece al Aplicar) */}
        <AnimatePresence>
          {geneticSuggestion && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="bg-amber-50/70 border border-amber-300/80 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 sm:block">
                      <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                        Cálculo Genético Heredado
                      </p>
                      {/* Botón X para cerrar en móvil */}
                      <button
                        type="button"
                        onClick={() => setGeneticSuggestion(null)}
                        className="sm:hidden p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer -mr-1 -mt-1"
                        title="Cerrar sugerencia"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-800 font-bold leading-snug break-words mt-0.5">
                      {geneticSuggestion.label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:self-center">
                  <button
                    type="button"
                    onClick={handleApplySuggestion}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Aplicar</span>
                  </button>
                  {/* Botón X para cerrar en desktop */}
                  <button
                    type="button"
                    onClick={() => setGeneticSuggestion(null)}
                    className="hidden sm:flex p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer"
                    title="Cerrar sugerencia"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Raza Principal</label>
            <CustomSelect
              value={selectedBreed || 'Mestizo'}
              onChange={(val) => {
                setValue('breed', val, { shouldDirty: true });
                if (val === 'Mestizo') {
                  setValue('purity_percentage', 50);
                }
              }}
              options={POPULAR_BREEDS.map(b => ({ value: b, label: b }))}
              bgClass="bg-white"
              searchable={true}
              searchPlaceholder="Buscar raza..."
            />
          </div>

          {/* Si es Mestizo: ocultar porcentaje numérico y slider */}
          {selectedBreed === 'Mestizo' ? (
            <div className="bg-white/70 border border-amber-200/60 rounded-2xl p-3.5 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">
                Composición del Cruce
              </span>
              {breedComposition && typeof breedComposition === 'object' && Object.keys(breedComposition).length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {Object.entries(breedComposition).map(([raza, pct]) => (
                    <span key={raza} className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2.5 py-1 rounded-xl text-xs font-bold border border-amber-200/70">
                      <span>{raza}:</span>
                      <span className="font-black text-amber-700">{pct}%</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500 font-medium italic">
                  Cruce mestizo general 
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Pureza Genética</label>
                <span className="text-xs font-bold text-amber-900">{selectedPurity ?? 100}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={selectedPurity ?? 100}
                  onChange={(e) => setValue('purity_percentage', Number(e.target.value))}
                  className="flex-1 accent-amber-600 h-2 bg-neutral-200 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedPurity ?? 100}
                  onChange={(e) => setValue('purity_percentage', Number(e.target.value))}
                  className="w-16 bg-white border border-neutral-200 rounded-xl px-2 py-2 text-center text-xs font-bold text-neutral-800"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. ESTADO Y DISPONIBILIDAD */}
      <section className="bg-white rounded-3xl p-5 mb-4 border border-neutral-200/70 shadow-2xs space-y-4">
        <div>
          <CustomSelect
            label="Estado del Animal"
            value={selectedStatus}
            onChange={(val) => setValue('status', val)}
            options={[
              { value: 'Activo', label: 'Activo (En el inventario)' },
              { value: 'Inactivo', label: 'Inactivo (Vendido, Muerte, etc.)' }
            ]}
          />
        </div>

        {selectedStatus === 'Inactivo' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Razón de la Inactividad</label>
            <textarea
              {...register('inactivity_reason')}
              placeholder="Ej: Vendido para carne, muerte por enfermedad..."
              className="w-full bg-neutral-50 rounded-xl px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 border border-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#1B4820]/20 min-h-[100px] resize-none"
            />
          </div>
        )}
      </section>

      {/* 5. ACORDEÓN: EVENTO NACIMIENTO */}
      <div className="bg-neutral-50 rounded-3xl p-5 mb-4 border border-neutral-200/70 shadow-2xs">
        <div 
          className="flex items-center justify-between cursor-pointer select-none" 
          onClick={() => toggleAccordion('birth')}
        >
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-emerald-600"></div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1B4820] flex items-center gap-2">
                <GiCow className="w-5 h-5 text-emerald-600" />
                Nacimiento
              </h3>
              
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              hasBirthData 
                ? 'bg-emerald-100 text-emerald-800 font-black' 
                : 'bg-neutral-200/70 text-neutral-500'
            }`}>
              {hasBirthData ? 'Con datos' : 'Opcional'}
            </span>
            <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${activeAccordions.birth ? 'rotate-180 text-[#1B4820]' : ''}`} />
          </div>
        </div>

        <AnimatePresence>
          {activeAccordions.birth && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-5 space-y-4">
                <ImageUploader id="birth" label="Foto al Nacer" preview={images.birth.preview} onCapture={(e) => handleImageCapture(e, 'birth')} onRemove={() => removeImage('birth')} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Fecha de Nacimiento</label>
                    <DateInput {...register('birth_date')} className="w-full bg-white rounded-xl px-4 py-3 text-neutral-800 border border-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Peso Cría al Nacer (KG)</label>
                    <input type="number" step="any" {...register('birth_weight_kg')} placeholder="Ej: 35" className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-100 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Peso Madre al Parto (KG)</label>
                    <input type="number" step="any" {...register('mother_weight_at_birth')} placeholder="Ej: 450" className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-100 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Longitud del Ombligo (1 - 9)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      placeholder="1 al 9"
                      {...register('navel_length', {
                        onChange: (e) => {
                          const cleaned = e.target.value.replace(/[^1-9]/g, '').slice(-1);
                          e.target.value = cleaned;
                          setValue('navel_length', cleaned || null, { shouldDirty: true });
                        }
                      })}
                      onKeyDown={(e) => {
                        if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter'].includes(e.key)) {
                          return;
                        }
                        if (!/^[1-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className={`w-full bg-white rounded-xl px-4 py-3 border transition-all outline-none focus:ring-2 focus:ring-[#1B4820]/20 font-bold text-neutral-800 ${
                        errors.navel_length ? 'border-red-500' : 'border-neutral-100 focus:border-[#1B4820]/30'
                      }`}
                    />
                    {errors.navel_length && (
                      <p className="text-red-500 text-[10px] mt-1 ml-1">{errors.navel_length.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Observaciones del Parto</label>
                  <textarea {...register('birth_observations')} placeholder="Detalles u observaciones del parto..." rows={2} className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-100 outline-none resize-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 6. ACORDEÓN: EVENTO DESTETE */}
      <div className="bg-neutral-50 rounded-3xl p-5 mb-4 border border-neutral-200/70 shadow-2xs">
        <div 
          className="flex items-center justify-between cursor-pointer select-none" 
          onClick={() => toggleAccordion('weaning')}
        >
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-amber-600"></div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1B4820] flex items-center gap-1.5">
                <Milk className="w-4 h-4 text-amber-600" />
                Destete
              </h3>
              
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              hasWeaningData 
                ? 'bg-amber-100 text-amber-800 font-black' 
                : 'bg-neutral-200/70 text-neutral-500'
            }`}>
              {hasWeaningData ? 'Con datos' : 'Opcional'}
            </span>
            <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${activeAccordions.weaning ? 'rotate-180 text-[#1B4820]' : ''}`} />
          </div>
        </div>

        <AnimatePresence>
          {activeAccordions.weaning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-5 space-y-4">
                <ImageUploader id="weaning" label="Foto al Destete" preview={images.weaning.preview} onCapture={(e) => handleImageCapture(e, 'weaning')} onRemove={() => removeImage('weaning')} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Fecha de Destete</label>
                    <DateInput {...register('weaning_date')} className="w-full bg-white rounded-xl px-4 py-3 text-neutral-800 border border-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Peso al Destete (KG)</label>
                    <input type="number" step="any" {...register('weaning_weight_kg')} placeholder="Ej: 180" className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-100 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                  </div>

                  {selectedSex !== 'Hembra' && (
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Circ. Escrotal al Destete (CM)</label>
                      <input type="number" step="any" {...register('sc_at_weaning')} placeholder="Ej: 20" className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-100 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Peso Madre al Destete (KG)</label>
                    <input type="number" step="any" {...register('mother_weight_at_weaning')} placeholder="Ej: 420" className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-100 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Observaciones del Destete</label>
                  <textarea {...register('weaning_observations')} placeholder="Detalles u observaciones del destete..." rows={2} className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-100 outline-none resize-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 7. MEDIDAS ACTUALES */}
      <section className="bg-neutral-50 rounded-3xl p-5 mb-4 border border-neutral-200/70 shadow-2xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-6 rounded-full bg-[#1B4820]"></div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1B4820] flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-[#1B4820]" />
              Peso Actual
            </h3>
            <p className="text-[11px] text-neutral-400 font-medium">Último pesaje del animal para control en inventario</p>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-1 block ml-1">Peso Actual (KG)</label>
          <input type="number" step="any" {...register('current_weight_kg')} placeholder="Ej: 250" className="w-full bg-white rounded-xl px-4 py-3 border border-neutral-200 outline-none focus:ring-2 focus:ring-[#1B4820]/20 transition-all font-bold text-neutral-800 text-sm" />
        </div>
      </section>

      {/* FOOTERS (¡Totalmente Restaurados!) */}
      {!isModal && (
        <div className="fixed bottom-0 left-0 w-full bg-[#fcfcfa]/90 backdrop-blur-md border-t border-neutral-100 p-4 z-40">
          <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-[#D15E5A] hover:bg-[#B94545] text-white rounded-full py-4 transition-all active:scale-95 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
              <span className="text-xs font-bold uppercase tracking-widest">Cancelar</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-[#1A3621] hover:bg-[#0F2912] text-white rounded-full py-4 transition-all active:scale-95 shadow-[0_4px_14px_rgba(26,54,33,0.3)] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-widest">Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" strokeWidth={2.5} />
                  <span className="text-xs font-bold uppercase tracking-widest">Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {isModal && (
        <div className="grid grid-cols-2 gap-3 mt-8">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 bg-[#D15E5A] text-white rounded-full py-4 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-xs font-bold uppercase tracking-widest">Cancelar</span>
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 bg-[#1A3621] text-white rounded-full py-4 shadow-lg shadow-emerald-900/20 transition-all active:scale-95 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-xs font-bold uppercase tracking-widest">Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" strokeWidth={2.5} />
                <span className="text-xs font-bold uppercase tracking-widest">Guardar</span>
              </>
            )}
          </button>
        </div>
      )}
    </form>

    {/* MODAL PARA CREAR NUEVA FINCA */}
    <FarmModal
      isOpen={isFarmModalOpen}
      onClose={() => setIsFarmModalOpen(false)}
      initialView="create"
      onFarmCreated={(newFarm) => setValue('farm_id', newFarm.id, { shouldDirty: true, shouldValidate: true })}
    />
  </>
);
}