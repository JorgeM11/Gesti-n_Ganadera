import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Users, 
  UserCheck, 
  UserX,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { calculateVaqueriaAnalysis } from '@/lib/vaqueriaUtils';
import { formatDateTimeLocal } from '@/lib/dateUtils';

/**
 * VaqueriaComparisonModal (Fase 4 - Req 10)
 * Modal de análisis comparativo entre 2 eventos de la misma finca.
 * Compara:
 * - Datos principales (nombre, fecha, estado, observaciones)
 * - Animales Presentes (Evento A vs Evento B y variación)
 * - Animales Faltantes (Evento A vs Evento B y variación)
 * - Cantidad Total de Animales (Rebaño evaluado)
 * - Desglose de flujo: Animales comunes, nuevos en B y ausentes en B.
 */
export default function VaqueriaComparisonModal({
  isOpen,
  onClose,
  vaqueria1,
  vaqueria2,
  farm,
  allVaqueriaAnimals = [],
  allAnimals = []
}) {
  const [activeDetailTab, setActiveDetailTab] = useState('summary'); // 'summary' | 'only_b' | 'absent_b' | 'common'

  // Ordenar cronológicamente (Evento A: más antiguo/base, Evento B: más reciente)
  const sortedEvents = useMemo(() => {
    if (!vaqueria1 || !vaqueria2) return [];
    const date1 = vaqueria1.date || vaqueria1.created_at || '';
    const date2 = vaqueria2.date || vaqueria2.created_at || '';
    if (date1 <= date2) {
      return [vaqueria1, vaqueria2];
    }
    return [vaqueria2, vaqueria1];
  }, [vaqueria1, vaqueria2]);

  const [eventA, eventB] = sortedEvents;

  const farmAnimals = useMemo(() => {
    if (!farm?.id) return [];
    return allAnimals.filter(a => a.farm_id === farm.id);
  }, [allAnimals, farm?.id]);

  // Análisis del Evento A
  const analysisA = useMemo(() => {
    if (!eventA) return null;
    const presentRecs = allVaqueriaAnimals.filter(r => r.vaqueria_id === eventA.id && !r.deleted_at);
    return calculateVaqueriaAnalysis({
      currentVaqueria: eventA,
      presentRecords: presentRecs,
      farmAnimals,
      allAnimals
    });
  }, [eventA, allVaqueriaAnimals, farmAnimals, allAnimals]);

  // Análisis del Evento B
  const analysisB = useMemo(() => {
    if (!eventB) return null;
    const presentRecs = allVaqueriaAnimals.filter(r => r.vaqueria_id === eventB.id && !r.deleted_at);
    return calculateVaqueriaAnalysis({
      currentVaqueria: eventB,
      presentRecords: presentRecs,
      farmAnimals,
      allAnimals
    });
  }, [eventB, allVaqueriaAnimals, farmAnimals, allAnimals]);

  // Métricas numéricas
  const presentA = analysisA?.kpis?.totalPresent || 0;
  const presentB = analysisB?.kpis?.totalPresent || 0;
  const diffPresent = presentB - presentA;

  const missingA = analysisA?.kpis?.totalMissing || 0;
  const missingB = analysisB?.kpis?.totalMissing || 0;
  const diffMissing = missingB - missingA;

  const totalA = presentA + missingA;
  const totalB = presentB + missingB;
  const diffTotal = totalB - totalA;

  // Cruce de animales entre ambos eventos
  const { commonAnimals, onlyInBAnimals, absentInBAnimals } = useMemo(() => {
    if (!analysisA || !analysisB) {
      return { commonAnimals: [], onlyInBAnimals: [], absentInBAnimals: [] };
    }

    const presentListA = analysisA.classifiedPresent || [];
    const presentListB = analysisB.classifiedPresent || [];

    const getKey = (item) => {
      if (item.record?.animal_id) return `id_${item.record.animal_id}`;
      if (item.animal?.id) return `id_${item.animal.id}`;
      if (item.displayChip && item.displayChip !== '---') return `chip_${item.displayChip}`;
      if (item.displayNumber && item.displayNumber !== '---') return `num_${item.displayNumber}`;
      return `name_${item.displayName}`;
    };

    const mapB = new Map();
    presentListB.forEach(item => {
      mapB.set(getKey(item), item);
    });

    const mapA = new Map();
    presentListA.forEach(item => {
      mapA.set(getKey(item), item);
    });

    const common = [];
    const absentInB = [];

    presentListA.forEach(itemA => {
      const key = getKey(itemA);
      if (mapB.has(key)) {
        common.push(itemA);
      } else {
        absentInB.push(itemA);
      }
    });

    const onlyInB = [];
    presentListB.forEach(itemB => {
      const key = getKey(itemB);
      if (!mapA.has(key)) {
        onlyInB.push(itemB);
      }
    });

    return {
      commonAnimals: common,
      onlyInBAnimals: onlyInB,
      absentInBAnimals: absentInB
    };
  }, [analysisA, analysisB]);

  if (!eventA || !eventB) return null;

  const renderDiffBadge = (diff, invertColors = false) => {
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-xs font-black">
          <Minus className="w-3 h-3 stroke-[3]" />
          <span>Sin cambio</span>
        </span>
      );
    }

    const isPositive = diff > 0;
    // Para presentes, positivo es bueno (verde). Para faltantes, positivo es alerta (rojo/ámbar).
    const isGood = invertColors ? !isPositive : isPositive;

    const bgClass = isGood ? 'bg-emerald-100 text-[#1B4820]' : 'bg-amber-100 text-amber-800';
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black ${bgClass}`}>
        <Icon className="w-3.5 h-3.5 stroke-[3]" />
        <span>{isPositive ? `+${diff}` : diff}</span>
      </span>
    );
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Comparación de Eventos"
      description={`Análisis comparativo de dos eventos en ${farm?.name || 'la finca'}`}
      maxWidth="max-w-4xl"
      style={{ zIndex: 65 }}
    >
      <div className="space-y-6 pt-1 pb-4">
        {/* Cabecera de Finca */}
        <div className="flex items-center justify-between gap-3 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-200/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#1B4820] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Finca Evaluada</span>
              <h4 className="text-sm font-black text-neutral-900 truncate">{farm?.name || 'Finca no asignada'}</h4>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[#1B4820] text-white text-[11px] font-black tracking-wide shrink-0">
            2 Eventos
          </span>
        </div>

        {/* Tarjetas Superiores: Evento A vs Evento B */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tarjeta Evento A */}
          <div className="bg-white rounded-2xl p-4 border-2 border-neutral-200 shadow-xs relative">
            <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-neutral-800 text-white text-[10px] font-black uppercase tracking-wider">
              Evento 1 (Base)
            </span>
            <div className="pt-1">
              <h4 className="text-base font-black text-neutral-900 line-clamp-1 mb-1">{eventA.name}</h4>
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-2">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>{eventA.date || 'Sin fecha'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                  eventA.status === 'Finalizada' ? 'bg-neutral-100 text-neutral-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {eventA.status || 'En progreso'}
                </span>
                {eventA.finalized_at && (
                  <span className="text-neutral-500 font-medium">
                    Fin: {formatDateTimeLocal(eventA.finalized_at)}
                  </span>
                )}
              </div>
              {eventA.observations && (
                <p className="mt-2 text-xs text-neutral-500 italic bg-neutral-50 p-2 rounded-xl border border-neutral-100 line-clamp-2">
                  "{eventA.observations}"
                </p>
              )}
            </div>
          </div>

          {/* Tarjeta Evento B */}
          <div className="bg-white rounded-2xl p-4 border-2 border-[#1B4820]/40 shadow-xs relative bg-emerald-50/10">
            <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-[#1B4820] text-white text-[10px] font-black uppercase tracking-wider">
              Evento 2 (Posterior)
            </span>
            <div className="pt-1">
              <h4 className="text-base font-black text-neutral-900 line-clamp-1 mb-1">{eventB.name}</h4>
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-2">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>{eventB.date || 'Sin fecha'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] ${
                  eventB.status === 'Finalizada' ? 'bg-neutral-100 text-neutral-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {eventB.status || 'En progreso'}
                </span>
                {eventB.finalized_at && (
                  <span className="text-neutral-500 font-medium">
                    Fin: {formatDateTimeLocal(eventB.finalized_at)}
                  </span>
                )}
              </div>
              {eventB.observations && (
                <p className="mt-2 text-xs text-neutral-500 italic bg-neutral-50 p-2 rounded-xl border border-neutral-100 line-clamp-2">
                  "{eventB.observations}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* MÉTRICAS COMPARATIVAS PRINCIPALES (Presentes, Faltantes, Total) */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1B4820]" />
            Comparación de Datos Principales
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {/* KPI 1: Presentes */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-neutral-600">Animales Presentes</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#1B4820] flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block">Evento 1 → Evento 2</span>
                  <div className="text-lg font-black text-neutral-900">
                    <span>{presentA}</span>
                    <span className="text-neutral-300 mx-1.5 font-normal">→</span>
                    <span className="text-[#1B4820]">{presentB}</span>
                  </div>
                </div>
                {renderDiffBadge(diffPresent, false)}
              </div>
              <span className="text-[10px] text-neutral-400 font-medium">
                {diffPresent > 0 
                  ? `Se registraron ${diffPresent} presentes más en el segundo evento.` 
                  : diffPresent < 0 
                    ? `Disminuyó en ${Math.abs(diffPresent)} animales presentes.` 
                    : 'Misma cantidad de animales presentes.'
                }
              </span>
            </div>

            {/* KPI 2: Faltantes */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-neutral-600">Animales Faltantes</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <UserX className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block">Evento 1 → Evento 2</span>
                  <div className="text-lg font-black text-neutral-900">
                    <span>{missingA}</span>
                    <span className="text-neutral-300 mx-1.5 font-normal">→</span>
                    <span className="text-amber-800">{missingB}</span>
                  </div>
                </div>
                {renderDiffBadge(diffMissing, true)}
              </div>
              <span className="text-[10px] text-neutral-400 font-medium">
                {diffMissing > 0 
                  ? `Aumentaron en ${diffMissing} los animales faltantes.` 
                  : diffMissing < 0 
                    ? `Disminuyeron los faltantes en ${Math.abs(diffMissing)} animales.` 
                    : 'Misma cantidad de faltantes.'
                }
              </span>
            </div>

            {/* KPI 3: Cantidad Total */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-neutral-600">Cantidad Total Evaluada</span>
                <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block">Evento 1 → Evento 2</span>
                  <div className="text-lg font-black text-neutral-900">
                    <span>{totalA}</span>
                    <span className="text-neutral-300 mx-1.5 font-normal">→</span>
                    <span className="text-neutral-800">{totalB}</span>
                  </div>
                </div>
                {renderDiffBadge(diffTotal, false)}
              </div>
              <span className="text-[10px] text-neutral-400 font-medium">
                Suma de presentes y faltantes evaluados en cada evento.
              </span>
            </div>
          </div>
        </div>

        {/* FLUJO Y FIDELIDAD DE ASISTENCIA */}
        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/70">
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#1B4820]" />
            Flujo de Animales entre Eventos
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setActiveDetailTab(activeDetailTab === 'common' ? 'summary' : 'common')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeDetailTab === 'common' 
                  ? 'bg-white border-[#1B4820] shadow-sm' 
                  : 'bg-white/70 border-neutral-200 hover:bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Presentes en Ambos</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-black text-[#1B4820]">{commonAnimals.length}</span>
                <span className="text-[10px] font-bold text-neutral-500">Repitieron</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveDetailTab(activeDetailTab === 'only_b' ? 'summary' : 'only_b')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeDetailTab === 'only_b' 
                  ? 'bg-white border-emerald-600 shadow-sm' 
                  : 'bg-white/70 border-neutral-200 hover:bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Nuevos en Evento 2</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-black text-emerald-700">+{onlyInBAnimals.length}</span>
                <span className="text-[10px] font-bold text-neutral-500">No estaban en E1</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveDetailTab(activeDetailTab === 'absent_b' ? 'summary' : 'absent_b')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeDetailTab === 'absent_b' 
                  ? 'bg-white border-amber-600 shadow-sm' 
                  : 'bg-white/70 border-neutral-200 hover:bg-white'
              }`}
            >
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Ausentes en Evento 2</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-black text-amber-700">-{absentInBAnimals.length}</span>
                <span className="text-[10px] font-bold text-neutral-500">Estuvieron en E1</span>
              </div>
            </button>
          </div>
        </div>

        {/* DETALLE EXPANDIBLE DE LISTAS (Si el usuario selecciona una categoría de flujo) */}
        {activeDetailTab !== 'summary' && (
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <h5 className="text-xs font-black text-neutral-800 uppercase tracking-wider">
                {activeDetailTab === 'common' && `Animales Presentes en Ambos (${commonAnimals.length})`}
                {activeDetailTab === 'only_b' && `Animales Nuevos en "${eventB.name}" (${onlyInBAnimals.length})`}
                {activeDetailTab === 'absent_b' && `Animales Ausentes en "${eventB.name}" (${absentInBAnimals.length})`}
              </h5>
              <button
                type="button"
                onClick={() => setActiveDetailTab('summary')}
                className="text-[11px] font-bold text-neutral-500 hover:text-neutral-800 cursor-pointer"
              >
                Ocultar lista
              </button>
            </div>

            {(() => {
              const currentList = activeDetailTab === 'common' 
                ? commonAnimals 
                : activeDetailTab === 'only_b' 
                  ? onlyInBAnimals 
                  : absentInBAnimals;

              if (currentList.length === 0) {
                return (
                  <div className="py-6 text-center text-xs text-neutral-400 font-medium">
                    No hay animales en esta categoría.
                  </div>
                );
              }

              return (
                <div className="divide-y divide-neutral-100 max-h-60 overflow-y-auto">
                  {currentList.map((item, idx) => {
                    const ident = item.displayNumber && item.displayNumber !== '---'
                      ? `#${item.displayNumber}`
                      : (item.displayChip && item.displayChip !== '---' ? `Chip ${item.displayChip}` : (item.displayName || 'Animal'));

                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-[10px] font-bold text-neutral-300 text-right">{idx + 1}</span>
                          <span className="font-black text-neutral-800 truncate">{ident}</span>
                          {item.displayName && item.displayName !== ident && (
                            <span className="text-neutral-500 text-[11px] truncate">({item.displayName})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                          {item.displaySex && (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-bold">
                              {item.displaySex}
                            </span>
                          )}
                          {item.displayBreed && (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-medium truncate max-w-[90px]">
                              {item.displayBreed}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
