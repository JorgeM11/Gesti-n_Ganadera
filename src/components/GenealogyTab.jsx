import React from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import AnimalImage from '@/components/inventario/AnimalImage';
import { Share2 } from 'lucide-react';

export default function GenealogyTab({ animal }) {
  const animalId = animal?.id;

  // --- CONSULTA DE DATOS ---
  const data = useLiveQuery(async () => {
    if (!animal) return null;

    // 1. Ascendencia
    const father = animal.father_id ? await db.animals.get(animal.father_id) : null;
    const mother = animal.mother_id ? await db.animals.get(animal.mother_id) : null;
    const gPaternalf = father?.father_id ? await db.animals.get(father.father_id) : null;
    const gPaternalm = father?.mother_id ? await db.animals.get(father.mother_id) : null;
    const gMaternalf = mother?.father_id ? await db.animals.get(mother.father_id) : null;
    const gMaternalm = mother?.mother_id ? await db.animals.get(mother.mother_id) : null;

    // 2. Descendencia Directa (Hijos)
    const children = await db.animals
      .where('mother_id').equals(animalId)
      .or('father_id').equals(animalId)
      .toArray()
      .then(res => res.filter(a => !a.deleted_at));

    // 3. Nietos (Hijos de los hijos)
    const childrenIds = children.map(c => c.id);
    const grandchildren = await db.animals
      .where('mother_id').anyOf(childrenIds)
      .or('father_id').anyOf(childrenIds)
      .toArray()
      .then(res => res.filter(a => !a.deleted_at));

    return { father, mother, gPaternalf, gPaternalm, gMaternalf, gMaternalm, children, grandchildren };
  }, [animal]);

  if (!animal || !data) return null;

  // --- COMPONENTES INTERNOS ---
  const NodeContent = ({ animal, label, variant, defaultSex }) => {
    const isMissing = !animal;
    const computedSex = animal?.sex || defaultSex || (label?.includes('Padre') || label?.includes('Abuelo') ? 'Macho' : 'Hembra');

    return (
      <div className="flex flex-col items-center z-10 shrink-0">
        <div className={`rounded-full border-2 overflow-hidden transition-all duration-200 ${
          variant === "main" 
            ? 'w-20 h-20 sm:w-24 sm:h-24 border-[#1B4820] ring-4 ring-emerald-100/80 shadow-lg scale-105 bg-white' 
            : isMissing
              ? 'w-14 h-14 sm:w-16 sm:h-16 border-dashed border-neutral-300 bg-neutral-100/80'
              : 'w-14 h-14 sm:w-16 sm:h-16 border-neutral-200/80 bg-white shadow-sm group-hover:scale-105 group-hover:border-[#1B4820]/40 group-hover:shadow-md'
        }`}>
          <AnimalImage 
            photoPath={animal?.photo_path} 
            photoBlob={animal?.photo_blob} 
            alt={animal?.number || label}
            sex={computedSex}
            birthDate={animal?.birth_date}
            className="w-full h-full object-cover" 
          />
        </div>
        <div className="mt-1.5 text-center max-w-[85px] sm:max-w-[110px] flex flex-col items-center">
          <p className={`font-black leading-tight ${
            variant === "main" 
              ? 'text-[#1B4820] text-sm sm:text-base' 
              : isMissing
                ? 'text-neutral-400 text-xs sm:text-sm font-medium'
                : 'text-neutral-800 text-xs sm:text-sm group-hover:text-[#1B4820] transition-colors'
          }`}>
            #{animal?.number || '---'}
          </p>
          <p className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-tight">{label}</p>
          {isMissing ? (
            <span className="inline-block font-semibold text-[8px] sm:text-[9px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-md mt-0.5">
              Sin registrar
            </span>
          ) : animal?.breed ? (
            <span className={`inline-block font-semibold truncate max-w-full px-1.5 py-0.2 rounded-md ${
              variant === "main"
                ? 'text-[10px] sm:text-xs font-bold text-[#1B4820] bg-emerald-50 border border-emerald-200/60 mt-0.5'
                : 'text-[8.5px] sm:text-[9.5px] text-neutral-600 bg-neutral-100 mt-0.5'
            }`}>
              {animal.breed}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const Node = ({ animal, label, variant = "default", defaultSex }) => {
    // Si el animal no existe (ej. un abuelo no registrado), renderiza solo el diseño sin Link
    if (!animal) {
      return <NodeContent animal={null} label={label} variant={variant} defaultSex={defaultSex} />;
    }

    // Redirige al perfil con tab=details
    return (
      <Link to={`/inventario/perfil?id=${animal.id}&tab=details`} className="block focus:outline-none group">
        <NodeContent animal={animal} label={label} variant={variant} defaultSex={defaultSex} />
      </Link>
    );
  };

  const LevelIndicator = ({ text }) => (
    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-white px-2.5 py-0.5 rounded-full border border-neutral-200/80 shadow-2xs z-20">
      <span className="text-[8px] sm:text-[9px] font-black text-neutral-500 uppercase tracking-widest whitespace-nowrap">{text}</span>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto py-2 pb-24 relative">
      {/* 1. TÍTULO DE SECCIÓN */}
      <div className="mb-6 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EEF7EE] text-[#1B4820] rounded-2xl border border-[#1B4820]/10 shadow-2xs">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-[#1B4820] leading-tight">Árbol Genealógico</h2>
            <p className="text-xs text-neutral-400 font-medium">Genealogía</p>
          </div>
        </div>
        <div className="bg-[#EEF7EE] px-3.5 py-1.5 rounded-2xl text-[#1B4820] font-black text-base border border-[#1B4820]/10 shadow-2xs">
          #{animal.number}
        </div>
      </div>

      {/* 2. TARJETA CONTENEDORA DEL ÁRBOL */}
      <div className="bg-white rounded-3xl p-4 sm:p-8 border border-neutral-100/90 shadow-xs relative overflow-hidden">
        {/* 1. NIVEL: ABUELOS */}
        <div className="grid grid-cols-4 gap-1 mb-4">
          <Node animal={data.gPaternalf} label="Abuelo Pat." defaultSex="Macho" />
          <Node animal={data.gPaternalm} label="Abuela Pat." defaultSex="Hembra" />
          <Node animal={data.gMaternalf} label="Abuelo Mat." defaultSex="Macho" />
          <Node animal={data.gMaternalm} label="Abuela Mat." defaultSex="Hembra" />
        </div>

        {/* LÍNEAS ABUELOS -> PADRES */}
        <div className="grid grid-cols-2 h-8 -mt-2 mb-2 relative">
          <div className="border-x border-t border-neutral-300 rounded-t-xl mx-auto w-1/2 h-full"></div>
          <div className="border-x border-t border-neutral-300 rounded-t-xl mx-auto w-1/2 h-full"></div>
        </div>

        {/* 2. NIVEL: PADRES */}
        <div className="grid grid-cols-2 gap-6 sm:gap-10 mb-6">
          <Node animal={data.father} label="Padre" defaultSex="Macho" />
          <Node animal={data.mother} label="Madre" defaultSex="Hembra" />
        </div>

        {/* LÍNEAS PADRES -> SUJETO (Con Etiqueta) */}
        <div className="relative h-10 -mt-4 mb-4">
          <div className="absolute top-0 left-1/4 right-1/4 h-full border-x border-b border-neutral-300 rounded-b-2xl"></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-1/2 bg-neutral-300"></div>
          <LevelIndicator text="Padres" />
        </div>

        {/* 3. NIVEL: ANIMAL ACTUAL (CENTRO) */}
        <div className="flex justify-center mb-8">
          <Node animal={animal} label="Sujeto Actual" variant="main" defaultSex={animal.sex} />
        </div>

        {/* LÍNEA SUJETO -> HIJOS (Con Etiqueta) */}
        <div className="relative h-10 -mt-8 mb-4">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-full bg-neutral-300"></div>
          <LevelIndicator text="Hijos" />
        </div>

        {/* 4. NIVEL: HIJOS */}
        <div className="w-full overflow-x-auto no-scrollbar py-2 mb-4">
          <div className="flex gap-4 w-max mx-auto px-4">
            {data.children.length > 0 ? (
              data.children.map(child => (
                <Node key={child.id} animal={child} label={child.sex === 'Hembra' ? 'Hija' : 'Hijo'} defaultSex={child.sex} />
              ))
            ) : (
              <div className="flex flex-col items-center text-neutral-300 py-3 w-full">
                <Share2 className="w-5 h-5 opacity-30" />
                <p className="text-[9px] font-bold uppercase tracking-wider mt-1 text-neutral-400">Sin Hijos Registrados</p>
              </div>
            )}
          </div>
        </div>

        {/* LÍNEAS HIJOS -> NIETOS (Con Etiqueta) */}
        {data.grandchildren.length > 0 && (
          <>
            <div className="relative h-10 -mt-2 mb-4">
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-neutral-300"></div>
              <LevelIndicator text="Nietos" />
            </div>

            {/* 5. NIVEL: NIETOS */}
            <div className="w-full overflow-x-auto no-scrollbar py-2">
              <div className="flex gap-4 w-max mx-auto px-4">
                {data.grandchildren.map(grandchild => (
                  <Node key={grandchild.id} animal={grandchild} label="Nieto(a)" defaultSex={grandchild.sex} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
