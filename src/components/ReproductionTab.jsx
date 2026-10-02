import React from 'react';
import { GiCow } from 'react-icons/gi';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PartosTab from './reproduction/PartosTab';

export default function ReproductionTab({ animal }) {
  const animalId = animal?.id;

  // Conteo reactivo de crías nacidas
  const offspringCount = useLiveQuery(
    () => db.animals
      .where('mother_id').equals(animalId)
      .and(a => !a.deleted_at)
      .count(),
    [animalId]
  ) ?? 0;

  if (!animal) return null;

  return (
    <div className="max-w-3xl mx-auto py-2 pb-24 relative">
      {/* 1. TÍTULO DE SECCIÓN */}
      <div className="mb-6 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EEF7EE] text-[#1B4820] rounded-2xl border border-[#1B4820]/10 shadow-2xs">
            <GiCow className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-[#1B4820] leading-tight">Registro Reproductivo</h2>
            <p className="text-xs text-neutral-400 font-medium">Historial de partos y crías ({offspringCount})</p>
          </div>
        </div>
        <div className="bg-[#EEF7EE] px-3.5 py-1.5 rounded-2xl text-[#1B4820] font-black text-base border border-[#1B4820]/10 shadow-2xs">
          #{animal.number}
        </div>
      </div>

      {/* 2. HISTORIAL DE PARTOS Y CRÍAS */}
      <PartosTab animalId={animalId} animal={animal} />
    </div>
  );
}
