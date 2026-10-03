import React from 'react';
import { 
  IdCard, Network, FileText, Pencil, CircleAlert, Building2, 
  Dna, Scale, Calendar, ArrowUpRight, Palette, Cpu, UserCheck, Tag
} from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import AnimalImage from '@/components/inventario/AnimalImage';
import { calculateAge, formatWeight, formatDateLocal } from '@/lib/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function InfoTile({ label, icon: Icon, children, className = '' }) {
  return (
    <div className={`p-3.5 bg-neutral-50/80 rounded-2xl border border-neutral-100 flex flex-col justify-between ${className}`}>
      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#1B4820]" />}
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

export default function DetailsTab({ animal, onEdit }) {
  const parents = useLiveQuery(
    async () => {
      if (!animal) return { father: null, mother: null };
      const father = animal.father_id ? await db.animals.get(animal.father_id) : null;
      const mother = animal.mother_id ? await db.animals.get(animal.mother_id) : null;
      return { father, mother };
    },
    [animal]
  );

  const farm = useLiveQuery(
    () => animal?.farm_id ? db.farms.get(animal.farm_id) : null,
    [animal?.farm_id]
  );

  const potrero = useLiveQuery(
    () => animal?.potrero_id ? db.potreros.get(animal.potrero_id) : null,
    [animal?.potrero_id]
  );

  const owner = useLiveQuery(
    () => animal?.owner_id ? db.owners.get(animal.owner_id) : null,
    [animal?.owner_id]
  );

  if (!animal) return null;

  const isFemale = animal.sex === 'Hembra';

  return (
    <div className="max-w-6xl mx-auto md:grid md:grid-cols-12 md:gap-8 md:items-start pb-6">

      {/* COLUMNA 1: Perfil Rápido y Métricas */}
      <div className="md:col-span-5 md:sticky md:top-32 space-y-4">
        
        {/* Contenedor de Foto con Badges Flotantes */}
        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-sm border border-neutral-200/70 bg-neutral-200 group">
          <AnimalImage
            photoPath={animal.photo_path}
            photoBlob={animal.photo_blob}
            alt={`#${animal.number}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Badge Estado */}
          <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-xs border border-white/20 bg-neutral-900/80 text-white">
            <span className={`w-2 h-2 rounded-full ${animal.status === 'Inactivo' ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span>{animal.status || 'Activo'}</span>
          </div>

          {/* Badge Sexo */}
          <div className="absolute top-3.5 right-3.5">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${
              isFemale ? 'bg-pink-600/90 backdrop-blur-xs' : 'bg-blue-700/90 backdrop-blur-xs'
            }`}>
              {animal.sex || 'Bovino'}
            </span>
          </div>
        </div>

        {/* Identificador Principal */}
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl sm:text-4xl font-black text-[#1B4820] tracking-tight block">
                #{animal.number}
              </span>
              {animal.name && (
                <span className="text-lg sm:text-xl font-bold text-neutral-800 self-end mb-1">
                  ({animal.name})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {animal.chip_number && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                  <Cpu className="w-3 h-3" />
                  Chip: {animal.chip_number}
                </span>
              )}
              {animal.color && (
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Color: {animal.color}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Raza</span>
            <span className="text-base font-black text-neutral-800">{animal.breed || 'Sin raza'}</span>
          </div>
        </div>

        {/* Quick Stats Grid (Peso y Edad) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-2xs border border-neutral-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
              <Scale className="w-4 h-4 text-[#1B4820]" />
              <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">Peso Actual</span>
            </div>
            <span className="text-2xl font-black text-[#1B4820] tracking-tight">
              {formatWeight(animal.last_weight_kg)}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-2xs border border-neutral-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
              <Calendar className="w-4 h-4 text-[#1B4820]" />
              <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">Edad Estimada</span>
            </div>
            <span className="text-lg font-black text-neutral-800 tracking-tight leading-snug">
              {calculateAge(animal.birth_date)}
            </span>
          </div>
        </div>

        {/* Botón Editar Información (Desktop) */}
        <button 
          onClick={onEdit}
          className="hidden md:flex w-full items-center justify-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold py-3.5 rounded-2xl shadow-sm transition-all hover:scale-[0.99] active:scale-95 cursor-pointer text-xs uppercase tracking-wider"
        >
          <Pencil className="w-4 h-4" /> Editar Información
        </button>
      </div>

      {/* COLUMNA 2: Información Detallada */}
      <div className="md:col-span-7 space-y-4 mt-6 md:mt-0">

        {/* Identificación Detallada */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-neutral-100/90 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <div className="p-2 bg-emerald-50 rounded-xl text-[#1B4820]">
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1B4820]">Identificación y Ubicación</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Datos del animal, propiedad y finca</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoTile label="Número de Arete" icon={IdCard}>
              <span className="font-black text-base text-neutral-900">#{animal.number}</span>
            </InfoTile>

            <InfoTile label="Número de Chip" icon={Cpu}>
              <span className="font-bold text-sm text-neutral-800">
                {animal.chip_number || 'Sin chip asignado'}
              </span>
            </InfoTile>

            <InfoTile label="Nombre" icon={Tag}>
              <span className="font-bold text-sm text-neutral-800">
                {animal.name || 'Sin nombre asignado'}
              </span>
            </InfoTile>

            <InfoTile label="Dueño / Propietario" icon={UserCheck}>
              <span className="font-bold text-sm text-neutral-800">
                {owner?.name || 'Sin dueño asignado'}
              </span>
            </InfoTile>

            <InfoTile label="Finca" icon={Building2}>
              <span className="font-bold text-sm text-neutral-800 truncate block">
                {farm?.name ? `${farm.name}${farm.location ? ` (${farm.location})` : ''}` : 'Sin finca asignada'}
              </span>
            </InfoTile>

            <InfoTile label="Potrero" icon={Building2}>
              <span className="font-bold text-sm text-neutral-800 truncate block">
                {potrero?.name || 'Sin potrero asignado'}
              </span>
            </InfoTile>

            <InfoTile label="Fecha de Nacimiento" icon={Calendar}>
              <span className="font-bold text-sm text-neutral-800">
                {formatDateLocal(animal.birth_date)}
              </span>
            </InfoTile>

            <InfoTile label="Sexo" icon={isFemale ? FaVenus : FaMars}>
              <span className="font-bold text-sm text-neutral-800">
                {animal.sex || '---'}
              </span>
            </InfoTile>

            <InfoTile label="Color / Pelaje" icon={Palette}>
              <span className="font-bold text-sm text-neutral-800">
                {animal.color || 'No especificado'}
              </span>
            </InfoTile>

            <InfoTile label="Raza" icon={Dna}>
              <span className="font-bold text-sm text-neutral-800">
                {animal.breed || 'Sin raza'}
              </span>
            </InfoTile>

            <InfoTile label="Estado en Inventario">
              <span className={`inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                animal.status === 'Inactivo' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {animal.status || 'Activo'}
              </span>
            </InfoTile>

            {animal.status === 'Inactivo' && animal.inactivity_reason && (
              <InfoTile label="Motivo de Baja" className="sm:col-span-2">
                <span className="font-bold text-xs text-red-600 block">
                  {animal.inactivity_reason}
                </span>
              </InfoTile>
            )}
          </div>
        </section>

        {/* Genealogía (ID de Padres) */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-neutral-100/90 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <div className="p-2 bg-amber-50 rounded-xl text-[#8C6746]">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1B4820]">Genealogía Registrada</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Madre y Padre del animal</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-neutral-50/80 rounded-2xl border border-neutral-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                Padre (Toro)
              </span>
              {parents?.father ? (
                <Link 
                  to={`/inventario/perfil?id=${parents.father.id}`}
                  className="inline-flex items-center gap-1 font-bold text-sm text-[#1B4820] hover:underline"
                >
                  #{parents.father.number} {parents.father.name ? `(${parents.father.name})` : ''}
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                </Link>
              ) : (
                <span className="text-sm font-semibold text-neutral-400">
                  {animal.father_id || 'No registrado / Desconocido'}
                </span>
              )}
            </div>

            <div className="p-4 bg-neutral-50/80 rounded-2xl border border-neutral-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                Madre (Vaca)
              </span>
              {parents?.mother ? (
                <Link 
                  to={`/inventario/perfil?id=${parents.mother.id}`}
                  className="inline-flex items-center gap-1 font-bold text-sm text-[#1B4820] hover:underline"
                >
                  #{parents.mother.number} {parents.mother.name ? `(${parents.mother.name})` : ''}
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                </Link>
              ) : (
                <span className="text-sm font-semibold text-neutral-400">
                  {animal.mother_id || 'No registrada / Desconocida'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Observaciones Generales */}
        {animal.observations && (
          <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-neutral-100/90 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-neutral-400" />
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Observaciones Generales</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-wrap bg-neutral-50/80 p-4 rounded-2xl border border-neutral-100">
              {animal.observations}
            </p>
          </section>
        )}
      </div>

      {/* Botón Flotante para MÓVIL (FAB) idéntico a los otros apartados */}
      <motion.button 
        initial={{ opacity: 0, scale: 0.88, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 8 }}
        transition={{ 
          type: "spring", 
          stiffness: 450, 
          damping: 30, 
          mass: 0.6 
        }}
        whileTap={{ scale: 0.92 }}
        onClick={onEdit}
        className="fixed bottom-20 right-4 z-30 md:hidden flex items-center gap-2 bg-[#1B4820] hover:bg-[#123316] text-white font-bold px-4 py-3 rounded-full shadow-[0_8px_25px_rgba(27,72,32,0.4)] border border-emerald-600/30 cursor-pointer text-xs uppercase tracking-wider backdrop-blur-xs"
        title="Editar Perfil"
        aria-label="Editar Perfil"
      >
        <Pencil className="w-4 h-4" />
        <span>Editar</span>
      </motion.button>

    </div>
  );
}