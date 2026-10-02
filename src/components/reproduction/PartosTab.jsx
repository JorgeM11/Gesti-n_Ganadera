import React from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { formatDateLocal } from '@/lib/dateUtils';
import { GiCow } from 'react-icons/gi';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { ArrowUpRight, Calendar, Scale, Dna } from 'lucide-react';

export default function PartosTab({ animalId, animal }) {
  const offspring = useLiveQuery(
    () => db.animals
      .where('mother_id').equals(animalId)
      .and(a => !a.deleted_at)
      .toArray()
      .then(res => res.sort((a, b) => (b.birth_date || '').localeCompare(a.birth_date || ''))),
    [animalId]
  ) || [];

  return (
    <div className="space-y-4">
      {offspring && offspring.length > 0 ? (
        <div className="space-y-3">
          {offspring.map((calf) => {
            const isMale = calf.sex === 'Macho';
            const SexIcon = isMale ? FaMars : FaVenus;

            return (
              <article 
                key={calf.id} 
                className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-100/90 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Avatar con Icono de Sexo */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs group-hover:scale-105 transition-transform ${
                    isMale 
                      ? 'bg-blue-50 text-blue-800 border-blue-100' 
                      : 'bg-pink-50 text-pink-800 border-pink-100'
                  }`}>
                    <SexIcon className="w-5 h-5" />
                  </div>

                  {/* Datos de la Cría */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        isMale ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                      }`}>
                        {calf.sex || 'Cría'}
                      </span>

                      {calf.birth_date && (
                        <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          {formatDateLocal(calf.birth_date)}
                        </span>
                      )}
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-neutral-900 group-hover:text-[#1B4820] transition-colors leading-snug">
                      Nacimiento de Cría #{calf.number}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium flex-wrap pt-0.5">
                      {calf.breed && (
                        <span className="flex items-center gap-1 bg-neutral-50 px-2 py-0.5 rounded-md border border-neutral-200/60 font-semibold">
                          <Dna className="w-3 h-3 text-neutral-400" />
                          {calf.breed}
                        </span>
                      )}

                      {calf.birth_weight_kg && (
                        <span className="flex items-center gap-1 bg-neutral-50 px-2 py-0.5 rounded-md border border-neutral-200/60 font-semibold">
                          <Scale className="w-3 h-3 text-neutral-400" />
                          {calf.birth_weight_kg} kg al nacer
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Enlace al perfil de la cría en su vista de detalles */}
                <div className="flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <Link
                    to={`/inventario/perfil?id=${calf.id}&tab=details`}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1B4820] bg-[#EEF7EE] border-[#1B4820]/20 md:text-neutral-600 md:bg-neutral-50 md:border-neutral-200/60 md:group-hover:text-[#1B4820] md:group-hover:bg-[#EEF7EE] md:group-hover:border-[#1B4820]/20 rounded-xl transition-colors cursor-pointer border"
                  >
                    <span>Ver Ficha</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#1B4820] md:text-neutral-400 md:group-hover:text-[#1B4820] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Estado Vacío Informativo (Sin botón de agregar) */
        <div className="bg-white rounded-3xl p-10 border border-neutral-100 text-center shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#1B4820] flex items-center justify-center mx-auto border border-emerald-100">
            <GiCow className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-black text-neutral-800">Sin partos registrados</h3>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              No se han registrado crías nacidas de #{animal?.number || 'este animal'}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
