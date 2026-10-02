import { useState, useEffect, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  Calendar,
  Ruler,
  Camera,
  Save,
  X,
  ChevronDown,
  CheckCircle,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Info,
  Trash2,
  Scale
} from "lucide-react";

// Importaciones Core
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";
import { addToSyncQueue, runFullSync } from "@/lib/syncUtils";
import { compressImage } from "@/lib/imageUtils";
import AnimalImage from "@/components/inventario/AnimalImage";
import BottomSheet from "@/components/ui/BottomSheet";
import { DateInput } from '@/components/ui/DateInput';

export default function EventForm({ 
  animal, 
  initialValues = null, 
  existingEvents = [], 
  onSubmitSuccess, 
  onCancel,
  isModal = false 
}) {
  const isEditing = !!initialValues?.id;

  // --- OPCIONES ---
  const tipoOpciones = ["Nacimiento", "Destete", "Peso a los 12 meses", "Peso a los 18 meses", "Otro"];
  const knownTypes = ["Nacimiento", "Destete", "Peso a los 12 meses", "Peso a los 18 meses"];

  // --- ESTADOS REACT ---
  const [tipoEvento, setTipoEvento] = useState(() => {
    if (!initialValues) return "Destete";
    if (knownTypes.includes(initialValues.event_type)) return initialValues.event_type;
    return "Otro";
  });

  const [eventoPersonalizado, setEventoPersonalizado] = useState(() => {
    if (!initialValues) return "";
    return knownTypes.includes(initialValues.event_type) ? "" : initialValues.event_type;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempNombreEvento, setTempNombreEvento] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [isTipoOpen, setIsTipoOpen] = useState(false);

  const [photoPreview, setPhotoPreview] = useState(() => {
    // FASE 2: Prioridad absoluta al binario local para modo Offline
    if (initialValues?.photo_blob) return URL.createObjectURL(initialValues.photo_blob);
    if (initialValues?.photo_path) return initialValues.photo_path;
    return null;
  });
  const [photoBlob, setPhotoBlob] = useState(null);
  const [isPhotoModified, setIsPhotoModified] = useState(false);
  const fileInputRef = useRef(null);

  // --- FORMULARIO ---
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      fechaEvento: initialValues?.event_date || new Date().toISOString().split('T')[0],
      pesoVaca: initialValues?.mother_weight_kg || "",
      pesoCria: initialValues?.weight_kg || "",
      circunferencia: initialValues?.scrotal_circumference_cm || "",
      largoViril: initialValues?.navel_length || "",
      observaciones: initialValues?.observations || "",
    },
  });

  // --- REGLAS CONDICIONALES DE VISIBILIDAD ---
  const currentEventType = tipoEvento === "Otro" && eventoPersonalizado ? eventoPersonalizado : tipoEvento;
  const isNacimiento = currentEventType?.trim().toLowerCase() === 'nacimiento';
  const isFemale = animal?.sex === 'Hembra';
  // Ocultar Circunferencia Escrotal si está seleccionado Nacimiento o si es hembra
  const showScrotal = !isNacimiento && !isFemale;

  // --- SINCRONIZACIÓN DE FOTO (MODO EDICIÓN) ---
  useEffect(() => {
    if (isEditing && initialValues) {
      if (initialValues.photo_blob) {
        setPhotoPreview(URL.createObjectURL(initialValues.photo_blob));
      } else if (initialValues.photo_path) {
        setPhotoPreview(initialValues.photo_path);
      }
    }
  }, [initialValues, isEditing]);

  // --- LÓGICA DE DUPLICADOS ---
  const isDuplicateBlocked = useMemo(() => {
    const uniqueEvents = ['Nacimiento', 'Destete'];
    if (!uniqueEvents.includes(tipoEvento)) return false;
    return existingEvents?.some(e => e.event_type === tipoEvento && e.id !== initialValues?.id);
  }, [tipoEvento, existingEvents, initialValues]);

  const duplicateWarning = useMemo(() => {
    if (isDuplicateBlocked) return null;
    return existingEvents?.find(e => e.event_type === tipoEvento && e.id !== initialValues?.id) || null;
  }, [tipoEvento, existingEvents, isDuplicateBlocked, initialValues]);

  // --- MANEJADORES ---
  const handleNumericInput = (e) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    e.target.value = val;
  };

  const preventInvalidNumberKeys = (e) => {
    if (['+', '-', 'e', 'E', '*', '/', '{', '}', 'ñ', 'Ñ'].includes(e.key) || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  };

  // Restricción para Longitud de Ombligo (solo texto del 1 al 9)
  const handleNavelKeyDown = (e) => {
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter'].includes(e.key)) {
      return;
    }
    if (!/^[1-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const selectTipoEvento = (opcion) => {
    if (opcion === "Otro") {
      setIsTipoOpen(false);
      setIsModalOpen(true);
    } else {
      setTipoEvento(opcion);
      setEventoPersonalizado("");
      setIsTipoOpen(false);
    }
  };

  const handleModalConfirm = () => {
    if (tempNombreEvento.trim()) {
      setEventoPersonalizado(tempNombreEvento);
      setTipoEvento("Otro");
    } else {
      setTipoEvento(isEditing ? (["Destete", "Peso a los 12 meses", "Peso a los 18 meses"].includes(initialValues.event_type) ? initialValues.event_type : "Destete") : "Destete");
    }
    setIsModalOpen(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhotoBlob(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setIsPhotoModified(true);
    } catch (err) {
      console.error('Error procesando imagen:', err);
    }
  };

  const removePhoto = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    setIsPhotoModified(true);
  };

  const getDisplayTitleExternal = () => {
    if (tipoEvento === "Otro" && eventoPersonalizado) return eventoPersonalizado;
    return tipoEvento;
  };

  // --- LÓGICA LOCAL-FIRST (Zero Delay) ---
  const getLocalUserId = () => {
    return localStorage.getItem("ganadera_user_id");
  };

  const onSubmit = async (data) => {
    if (isSaving || isDuplicateBlocked) return;
    setIsSaving(true);

    try {
      const userId = getLocalUserId();
      
      if (!userId) {
        window.location.href = '/login';
        return;
      }

      const now = new Date().toISOString();

      // --- MAGIA OFFLINE: SOLO GUARDAMOS EL BLOB EN DEXIE ---
      const eventData = {
        id: isEditing ? initialValues.id : crypto.randomUUID(),
        user_id: userId,
        animal_id: animal.id,
        event_type: getDisplayTitleExternal(),
        event_date: data.fechaEvento,
        weight_kg: data.pesoCria ? parseFloat(data.pesoCria) : null,
        mother_weight_kg: data.pesoVaca ? parseFloat(data.pesoVaca) : null,
        scrotal_circumference_cm: showScrotal && data.circunferencia ? parseFloat(data.circunferencia) : null,
        navel_length: data.largoViril ? data.largoViril.trim() : null,
        observations: data.observaciones || null,
        photo_path: isPhotoModified ? null : (isEditing ? initialValues.photo_path : null),
        photo_blob: photoBlob || (isEditing && !isPhotoModified ? initialValues.photo_blob : null),
        created_at: isEditing ? initialValues.created_at : now,
        updated_at: now,
      };

      await db.transaction('rw', [db.growth_events, db.animals, db.sync_queue], async () => {
        const syncOps = [];

        if (isEditing) {
          await db.growth_events.put(eventData);
          syncOps.push({ table_name: 'growth_events', operation: 'UPDATE', payload: eventData, created_at: now, status: 'PENDING' });
        } else {
          await db.growth_events.add(eventData);
          syncOps.push({ table_name: 'growth_events', operation: 'INSERT', payload: eventData, created_at: now, status: 'PENDING' });
        }

        // Sincronizar fecha y peso de nacimiento si es un evento de Nacimiento para actualizar la edad y peso en la ficha
        if (eventData.event_type === 'Nacimiento') {
          const animalUpdate = {
            birth_date: eventData.event_date,
            updated_at: now
          };
          if (eventData.weight_kg) {
            animalUpdate.birth_weight_kg = eventData.weight_kg;
          }
          await db.animals.update(animal.id, animalUpdate);
          syncOps.push({
            table_name: 'animals',
            operation: 'PATCH',
            payload: { id: animal.id, ...animalUpdate },
            created_at: now,
            status: 'PENDING'
          });
        }

        // Guardar operaciones de sincronización en bloque
        await db.sync_queue.bulkAdd(syncOps);
      });

      // Disparar sincronización fuera de la transacción
      if (navigator.onLine) {
        setTimeout(runFullSync, 500);
      }

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        onSubmitSuccess();
      }, 400);

    } catch (err) {
      console.error('Error guardando evento:', err);
      alert('Error al guardar el evento. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col space-y-5">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed z-[100] px-5 py-3.5 bg-[#1B4820] text-white rounded-2xl shadow-xl transition-all animate-in fade-in slide-in-from-top-5 top-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:-translate-x-0 font-bold text-sm flex items-center gap-3 w-[90%] max-w-sm sm:w-auto border border-emerald-500/30">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{isEditing ? 'Evento actualizado exitosamente' : 'Evento registrado exitosamente'}</span>
        </div>
      )}

      {/* Hero Card Dinámico (Modo Página Completa) */}
      {!isModal && (
        <div className="relative w-full h-44 rounded-3xl overflow-hidden shadow-sm bg-neutral-900 group">
          <AnimalImage 
            photoPath={animal.photo_path} 
            photoBlob={animal.photo_blob} 
            alt={`#${animal.number}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
          <div className="absolute bottom-5 left-6 flex flex-col gap-0.5">
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">
              Animal #{animal.number}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              {getDisplayTitleExternal()}
            </span>
          </div>
        </div>
      )}

      {/* Selector: Tipo de Evento */}
      <div className="w-full relative z-20">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2 px-1">
          Tipo de Evento
        </label>
        <div
          className={`w-full bg-white font-black text-neutral-800 text-base rounded-2xl px-5 py-3.5 shadow-2xs flex items-center justify-between cursor-pointer border transition-all ${
            isTipoOpen 
              ? "border-[#1B4820] ring-2 ring-[#1B4820]/15" 
              : "border-neutral-200/80 hover:border-neutral-300"
          }`}
          onClick={() => setIsTipoOpen(!isTipoOpen)}
        >
          <span>{tipoEvento === 'Otro' && eventoPersonalizado ? eventoPersonalizado : tipoEvento}</span>
          <ChevronDown className={`w-4 h-4 text-[#1B4820] transition-transform duration-300 ${isTipoOpen ? "rotate-180" : ""}`} />
        </div>

        {isDuplicateBlocked && (
          <div className="mt-2 flex items-center gap-2 px-3.5 py-2.5 bg-red-50 text-red-700 rounded-xl border border-red-200/80 animate-in fade-in slide-in-from-top-1">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs font-bold leading-tight">Ya existe un registro de "{tipoEvento}". No se puede duplicar este evento único.</p>
          </div>
        )}

        {duplicateWarning && (
          <div className="mt-2 flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 text-amber-800 rounded-xl border border-amber-200/80 animate-in fade-in slide-in-from-top-1">
            <Info className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs font-bold leading-tight">Ya existe un registro previo de "{tipoEvento}". Se añadirá un nuevo pesaje adicional.</p>
          </div>
        )}

        {isTipoOpen && (
          <div className="absolute top-[76px] left-0 w-full bg-white/98 backdrop-blur-md rounded-2xl shadow-xl border border-neutral-200/80 overflow-hidden py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            {tipoOpciones.map((opcion) => (
              <div
                key={opcion}
                onClick={() => selectTipoEvento(opcion)}
                className={`px-5 py-3 font-bold text-sm cursor-pointer hover:bg-emerald-50 transition-colors flex items-center justify-between ${
                  tipoEvento === opcion ? "text-[#1B4820] bg-emerald-50/70 font-black" : "text-neutral-700"
                }`}
              >
                <span>{opcion}</span>
                {tipoEvento === opcion && <div className="w-2 h-2 rounded-full bg-[#1B4820]" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Datos Pesaje */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-2xs border border-neutral-200/80 flex flex-col focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-50 text-[#1B4820] rounded-lg">
              <Scale className="w-4 h-4" />
            </div>
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
              Peso Animal (KG)
            </label>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            onKeyDown={preventInvalidNumberKeys}
            className="text-2xl font-black text-[#1B4820] outline-none w-full bg-transparent placeholder-neutral-200"
            {...register("pesoCria", { onChange: handleNumericInput })}
          />
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-2xs border border-neutral-200/80 flex flex-col focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 text-amber-800 rounded-lg">
              <Scale className="w-4 h-4" />
            </div>
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
              Peso Madre (KG)
            </label>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            onKeyDown={preventInvalidNumberKeys}
            className="text-2xl font-black text-amber-900 outline-none w-full bg-transparent placeholder-neutral-200"
            {...register("pesoVaca", { onChange: handleNumericInput })}
          />
        </div>
      </div>

      {/* FECHA Y MEDIDAS */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-neutral-200/80 space-y-5">
        {/* Fecha del Evento */}
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2 px-1">
            Fecha del Evento
          </label>
          <div className="flex items-center gap-3 bg-neutral-50 hover:bg-neutral-100/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 focus-within:border-emerald-600 rounded-2xl px-4 py-3.5 border border-neutral-200/80 transition-all">
            <Calendar className="w-5 h-5 text-[#1B4820]/70 flex-shrink-0" />
            <DateInput className="font-bold text-neutral-900 text-base outline-none w-full bg-transparent" {...register("fechaEvento")} />
          </div>
        </div>

        <div className="h-[1px] bg-neutral-100 w-full" />

        {/* Medidas Biológicas: Circunferencia Escrotal y Longitud del Ombligo */}
        <div className={`grid ${showScrotal ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
          {showScrotal && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Circ. Escrotal (CM)
                </label>
                <span className="text-[10px] text-neutral-400 font-medium">Opcional</span>
              </div>
              <div className="flex items-center gap-3 bg-neutral-50 hover:bg-neutral-100/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 focus-within:border-emerald-600 rounded-2xl px-4 py-3.5 border border-neutral-200/80 transition-all">
                <Ruler className="w-5 h-5 text-[#1B4820]/70 flex-shrink-0" />
                <input 
                  type="text" 
                  inputMode="decimal" 
                  placeholder="0.0" 
                  onKeyDown={preventInvalidNumberKeys} 
                  className="font-black text-neutral-900 text-base outline-none w-full bg-transparent placeholder-neutral-300" 
                  {...register("circunferencia", { onChange: handleNumericInput })} 
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Longitud del Ombligo 
              </label>
              
            </div>
            <div className="flex items-center gap-3 bg-neutral-50 hover:bg-neutral-100/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 focus-within:border-emerald-600 rounded-2xl px-4 py-3.5 border border-neutral-200/80 transition-all">
              <Ruler className="w-5 h-5 text-[#1B4820]/70 flex-shrink-0" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-9]"
                maxLength={1}
                placeholder="1 - 9"
                onKeyDown={handleNavelKeyDown}
                className="font-black text-neutral-900 text-base outline-none w-full bg-transparent placeholder-neutral-300"
                {...register("largoViril", {
                  onChange: (e) => {
                    const clean = e.target.value.replace(/[^1-9]/g, '').slice(0, 1);
                    setValue('largoViril', clean);
                  }
                })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      <div className="bg-white rounded-3xl p-5 shadow-2xs border border-neutral-200/80 space-y-2">
        <div className="flex items-center gap-2 ml-1">
          <MessageSquare className="w-4 h-4 text-[#1B4820]" />
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Notas u Observaciones
          </label>
        </div>
        <textarea
          placeholder="Añade detalles relevantes sobre este pesaje o evento..."
          rows={3}
          className="font-medium text-neutral-800 text-sm outline-none w-full bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 rounded-2xl p-4 border border-neutral-200/80 transition-all resize-none placeholder-neutral-300 min-h-[90px]"
          {...register("observaciones")}
        />
      </div>

      {/* Fotografía del Evento */}
      <div className="bg-white rounded-3xl p-5 shadow-2xs border border-neutral-200/80 space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block ml-1">
          Fotografía del Evento
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative h-44 border-2 border-dashed border-neutral-200 hover:border-emerald-600 rounded-2xl flex flex-col items-center justify-center bg-neutral-50/50 hover:bg-emerald-50/20 cursor-pointer active:scale-[0.99] transition-all overflow-hidden group"
        >
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removePhoto(); }}
                className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-md active:scale-90 transition-all z-10 cursor-pointer"
                title="Eliminar foto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <div className="bg-emerald-50 text-[#1B4820] p-3 rounded-2xl group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-black text-neutral-700 block">Tomar o subir foto</span>
                <span className="text-[10px] text-neutral-400 font-medium">Opcional para documentar el evento</span>
              </div>
            </div>
          )}
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" />
        </div>
      </div>

      {/* Footer Acciones */}
      <div className={`${isModal ? "pt-2" : "fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-neutral-200/80 py-4 px-5 z-40"}`}>
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-700 rounded-full py-3.5 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Cancelar</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving || isDuplicateBlocked}
            className={`flex items-center justify-center gap-2 rounded-full py-3.5 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
              isDuplicateBlocked 
                ? "bg-neutral-300 text-neutral-500 cursor-not-allowed" 
                : "bg-[#1B4820] hover:bg-[#123316] text-white cursor-pointer shadow-emerald-900/20"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'Guardar' : 'Registrar'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL: Nombre del Evento Personalizado */}
      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTipoEvento(isEditing ? (knownTypes.includes(initialValues.event_type) ? initialValues.event_type : "Destete") : "Destete");
        }}
        title="Tipo de Evento Personalizado"
        description="Define el nombre para este pesaje o evento especial."
      >
        <div className="flex flex-col pb-2 space-y-4">
          <input
            type="text"
            onChange={(e) => setTempNombreEvento(e.target.value)}
            value={tempNombreEvento}
            placeholder="Ej. Pesaje de Verano"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-lg font-black text-neutral-900 outline-none focus:border-emerald-600 focus:bg-white transition-all"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setTipoEvento(isEditing ? (knownTypes.includes(initialValues.event_type) ? initialValues.event_type : "Destete") : "Destete");
              }}
              className="py-3.5 font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full uppercase tracking-wider text-xs transition-all active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleModalConfirm}
              className="py-3.5 font-bold text-white bg-[#1B4820] hover:bg-[#123316] rounded-full shadow-md uppercase tracking-wider text-xs transition-all active:scale-95 cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}