import React from 'react';
import { 
  IdCard, Network, FileText, Pencil, CircleAlert, Building2, 
  Dna, Scale, Calendar, ArrowUpRight, HeartHandshake, Palette
} from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import AnimalImage from '@/components/inventario/AnimalImage';
import { calculateAge, formatWeight, formatDateLocal } from '@/lib/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Componente que muestra la pureza genética respetando:
 * - Si es raza pura/específica: muestra el porcentaje individual (ej. 100% o 85%).
 * - Si es Mestizo: muestra el desglose porcentual de cada raza SIN mostrar un porcentaje global.
 */
function GeneticsPurityDisplay({ breed, purity, composition }) {
  const isMestizo = !breed || breed.toLowerCase() === 'mestizo';

  if (!isMestizo) {
    const pct = purity !== undefined && purity !== null ? Math.round(Number(purity)) : 100;
    return (
      <div className="flex items-center gap-2 mt-0.5">
        <span className="font-black text-neutral-900 text-sm">{pct}%</span>
        {pct >= 90 && (
          <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
            Puro
          </span>
        )}
      </div>
    );
  }

  // Es Mestizo: Mostrar desglose de cada raza SIN porcentaje global
  let entries = [];
  if (composition && typeof composition === 'object') {
    entries = Object.entries(composition)
      .filter(([raza, pct]) => Number(pct) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
  }

  if (entries.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {entries.map(([raza, pct]) => (
          <span
            key={raza}
            className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs"
          >
            <span>{raza}:</span>
            <span className="font-black text-amber-700">{Math.round(Number(pct))}%</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-0.5">
      <span className="text-xs font-semibold text-neutral-500 italic">
        Cruce mestizo (sin desglose específico)
      </span>
    </div>
  );
}

function InfoTile({ label, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-neutral-50/70 border border-neutral-100 rounded-2xl p-3.5 flex flex-col justify-between ${className}`}>
      <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />}
        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 truncate">{label}</span>
      </div>
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

  const originService = useLiveQuery(
    () => animal?.origin_service_id
      ? db.services.get(animal.origin_service_id)
      : null,
    [animal]
  );

  const farm = useLiveQuery(
    () => animal?.farm_id ? db.farms.get(animal.farm_id) : null,
    [animal?.farm_id]
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
        </div>

        {/* Identificador Principal */}
        <div className="flex items-center justify-between px-1">
          <div>
            <span className="text-3xl sm:text-4xl font-black text-[#1B4820] tracking-tight block">
              #{animal.number}
            </span>
            {animal.color && (
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mt-0.5">
                {animal.color}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Raza Principal</span>
            <span className="text-base font-black text-neutral-800">{animal.breed || 'Mestizo'}</span>
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

        {/* Botón Editar en Desktop */}
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
              <h3 className="text-base sm:text-lg font-bold text-[#1B4820]">Identificación Detallada</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Parámetros biológicos y registro en hacienda</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoTile label="Número / ID" icon={IdCard}>
              <span className="font-black text-base text-neutral-900">#{animal.number}</span>
            </InfoTile>

            <InfoTile label="Finca" icon={Building2}>
              <span className="font-bold text-sm text-neutral-800 truncate block">
                {farm?.name ? `${farm.name}${farm.location ? ` (${farm.location})` : ''}` : 'Sin finca asignada'}
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

            <InfoTile label="Raza Principal" icon={Dna}>
              <span className="font-bold text-sm text-neutral-800">
                {animal.breed || 'Mestizo'}
              </span>
            </InfoTile>

            {/* Pureza Genética: Si es raza pura muestra el %, si es mestizo muestra desglose SIN porcentaje global */}
            <InfoTile 
              label="Pureza Genética" 
              icon={Dna} 
              className={(!animal.breed || animal.breed === 'Mestizo') ? 'sm:col-span-2' : ''}
            >
              <GeneticsPurityDisplay 
                breed={animal.breed} 
                purity={animal.purity_percentage} 
                composition={animal.breed_composition} 
              />
            </InfoTile>

            {originService && (
              <InfoTile label="Servicio de Origen" icon={HeartHandshake} className="sm:col-span-2">
                <span className="font-bold text-sm text-neutral-800 block">
                  {originService.type_conception || 'Servicio registrado'} {originService.service_date ? `· ${formatDateLocal(originService.service_date)}` : ''}
                </span>
              </InfoTile>
            )}

            <InfoTile label="Estado en Inventario">
              <span className={`inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                animal.status === 'Inactivo' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {animal.status || 'Activo'}
              </span>
            </InfoTile>
          </div>
        </section>

        {/* Genealogía (ID de Padres) */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-neutral-100/90 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
            <div className="p-2 bg-amber-50 rounded-xl text-[#8C6746]">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1B4820]">Genealogía Directa</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Linaje parental directo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Padre */}
            {animal.father_id ? (
              <Link 
                to={`/inventario/perfil?id=${animal.father_id}&tab=details`} 
                className="group bg-neutral-50/80 hover:bg-emerald-50/50 border border-neutral-200/80 hover:border-[#1B4820]/40 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                      <FaMars className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Padre (Toro)</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#1B4820] md:text-neutral-400 md:group-hover:text-[#1B4820] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black text-neutral-900 group-hover:text-[#1B4820] transition-colors">
                    {parents?.father?.number ? `#${parents.father.number}` : `#${animal.father_id.split('-')[0]}`}
                  </span>
                  {parents?.father?.breed && (
                    <span className="text-[10px] font-bold text-neutral-500 bg-white px-2 py-0.5 rounded-md border border-neutral-200/60">
                      {parents.father.breed}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="bg-neutral-50/60 border border-neutral-100 rounded-2xl p-4 flex items-center gap-3 text-neutral-400">
                <div className="w-7 h-7 rounded-xl bg-neutral-200/60 text-neutral-400 flex items-center justify-center">
                  <FaMars className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Padre</span>
                  <span className="text-xs font-semibold text-neutral-500">No registrado</span>
                </div>
              </div>
            )}

            {/* Madre */}
            {animal.mother_id ? (
              <Link 
                to={`/inventario/perfil?id=${animal.mother_id}&tab=details`} 
                className="group bg-neutral-50/80 hover:bg-emerald-50/50 border border-neutral-200/80 hover:border-[#1B4820]/40 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-pink-100 text-pink-800 flex items-center justify-center">
                      <FaVenus className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Madre (Vaca)</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#1B4820] md:text-neutral-400 md:group-hover:text-[#1B4820] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black text-neutral-900 group-hover:text-[#1B4820] transition-colors">
                    {parents?.mother?.number ? `#${parents.mother.number}` : `#${animal.mother_id.split('-')[0]}`}
                  </span>
                  {parents?.mother?.breed && (
                    <span className="text-[10px] font-bold text-neutral-500 bg-white px-2 py-0.5 rounded-md border border-neutral-200/60">
                      {parents.mother.breed}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="bg-neutral-50/60 border border-neutral-100 rounded-2xl p-4 flex items-center gap-3 text-neutral-400">
                <div className="w-7 h-7 rounded-xl bg-neutral-200/60 text-neutral-400 flex items-center justify-center">
                  <FaVenus className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Madre</span>
                  <span className="text-xs font-semibold text-neutral-500">No registrada</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Observaciones */}
        {animal.observations && (
          <section className="bg-[#F4F5F0] p-5 rounded-3xl border border-neutral-200/60 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#1B4820]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1B4820]">Observaciones del Ganadero</h3>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed font-medium">
              {animal.observations}
            </p>
          </section>
        )}

        {/* Razón de Inactividad (Solo si aplica) */}
        {animal.status === 'Inactivo' && (
          <section className="bg-red-50/80 p-5 rounded-3xl border border-red-200 animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5">
            <div className="flex items-center gap-2 text-red-700">
              <CircleAlert className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Razón de Inactividad</h3>
            </div>
            <p className="text-sm text-red-600 leading-relaxed font-bold">
              {animal.inactivity_reason || 'No se especificó una razón para la baja del animal.'}
            </p>
          </section>
        )}

        {/* Botón Flotante Editar para MÓVIL (FAB) */}
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
          title="Editar Animal"
          aria-label="Editar Animal"
        >
          <Pencil className="w-4 h-4" />
          <span>Editar</span>
        </motion.button>
      </div>
    </div>
  );
}