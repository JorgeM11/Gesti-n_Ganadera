import React, { useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Users, 
  UserCheck, 
  UserX,
  Sparkles
} from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { calculateVaqueriaAnalysis } from '@/lib/vaqueriaUtils';
import { formatDateTimeLocal } from '@/lib/dateUtils';

/**
 * VaqueriaComparisonModal (Fase 4 - Req 10)
 * Modal amigable de análisis comparativo entre 2 eventos de la misma finca.
 * Compara:
 * - Datos principales (nombre, fecha, estado, fecha de finalización)
 * - Cantidad de animales presentes (con variación)
 * - Cantidad de animales faltantes (con variación)
 * - Cantidad total evaluada (con variación)
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

  if (!eventA || !eventB) return null;

  const renderDiffBadge = (diff, invertColors = false) => {
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-black shrink-0">
          <Minus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Sin cambio</span>
        </span>
      );
    }

    const isPositive = diff > 0;
    // Para presentes, positivo es verde. Para faltantes, positivo es ámbar/rojo.
    const isGood = invertColors ? !isPositive : isPositive;

    const bgClass = isGood 
      ? 'bg-emerald-100 text-[#1B4820] border border-emerald-200/70' 
      : 'bg-amber-100 text-amber-900 border border-amber-200/70';
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-xs shrink-0 ${bgClass}`}>
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
      description={`Comparando dos eventos de ${farm?.name || 'la finca'}`}
      maxWidth="max-w-3xl"
      style={{ zIndex: 65 }}
    >
      <div className="space-y-5 pt-1 pb-4">
        {/* Cabecera amigable de la Finca */}
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

        {/* Tarjetas Superiores: Evento 1 vs Evento 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tarjeta Evento 1 */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-neutral-200/80 shadow-xs relative flex flex-col justify-between">
            <span className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-neutral-800 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
              1° Evento (Base)
            </span>
            <div className="pt-1">
              <h4 className="text-base font-black text-neutral-900 line-clamp-1 mb-1.5">{eventA.name}</h4>
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 mb-3">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>{eventA.date || 'Sin fecha'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black uppercase text-[10px] ${
                  eventA.status === 'Finalizada' ? 'bg-neutral-100 text-neutral-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {eventA.status === 'Finalizada' ? <CheckCircle2 className="w-3 h-3 text-neutral-500" /> : <Clock className="w-3 h-3 text-[#1B4820]" />}
                  {eventA.status || 'En progreso'}
                </span>
                {eventA.finalized_at && (
                  <span className="text-[11px] text-neutral-500 font-bold">
                    Fin: {formatDateTimeLocal(eventA.finalized_at)}
                  </span>
                )}
              </div>
              {eventA.observations && (
                <p className="mt-2.5 text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 line-clamp-2">
                  {eventA.observations}
                </p>
              )}
            </div>
          </div>

          {/* Tarjeta Evento 2 */}
          <div className="bg-emerald-50/20 rounded-3xl p-4 sm:p-5 border-2 border-[#1B4820]/40 shadow-xs relative flex flex-col justify-between">
            <span className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-[#1B4820] text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
              2° Evento (Posterior)
            </span>
            <div className="pt-1">
              <h4 className="text-base font-black text-neutral-900 line-clamp-1 mb-1.5">{eventB.name}</h4>
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 mb-3">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>{eventB.date || 'Sin fecha'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black uppercase text-[10px] ${
                  eventB.status === 'Finalizada' ? 'bg-neutral-100 text-neutral-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {eventB.status === 'Finalizada' ? <CheckCircle2 className="w-3 h-3 text-neutral-500" /> : <Clock className="w-3 h-3 text-[#1B4820]" />}
                  {eventB.status || 'En progreso'}
                </span>
                {eventB.finalized_at && (
                  <span className="text-[11px] text-neutral-500 font-bold">
                    Fin: {formatDateTimeLocal(eventB.finalized_at)}
                  </span>
                )}
              </div>
              {eventB.observations && (
                <p className="mt-2.5 text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 line-clamp-2">
                  {eventB.observations}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* COMPARACIÓN DE MÉTRICAS PRINCIPALES */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 pt-1">
            <Sparkles className="w-3.5 h-3.5 text-[#1B4820]" />
            Métricas Comparativas
          </h4>

          {/* Tarjeta 1: Animales Presentes */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#1B4820] flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-neutral-900">Animales Presentes</h4>
                  <p className="text-[11px] font-medium text-neutral-400">Animales Presentes</p>
                </div>
              </div>
              {renderDiffBadge(diffPresent, false)}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-neutral-50/70 p-3.5 rounded-2xl border border-neutral-100">
              <div className="text-center border-r border-neutral-200/70 pr-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-0.5 truncate">
                  {eventA.name}
                </span>
                <span className="text-2xl font-black text-neutral-800">{presentA}</span>
                <span className="text-[10px] font-bold text-neutral-400 block">cabezas</span>
              </div>
              <div className="text-center pl-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1B4820] block mb-0.5 truncate">
                  {eventB.name}
                </span>
                <span className="text-2xl font-black text-[#1B4820]">{presentB}</span>
                <span className="text-[10px] font-bold text-[#1B4820]/70 block">cabezas</span>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Animales Faltantes */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-neutral-900">Animales Faltantes</h4>
                  <p className="text-[11px] font-medium text-neutral-400">Animales Ausentes</p>
                </div>
              </div>
              {renderDiffBadge(diffMissing, true)}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-neutral-50/70 p-3.5 rounded-2xl border border-neutral-100">
              <div className="text-center border-r border-neutral-200/70 pr-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-0.5 truncate">
                  {eventA.name}
                </span>
                <span className="text-2xl font-black text-neutral-800">{missingA}</span>
                <span className="text-[10px] font-bold text-neutral-400 block">faltantes</span>
              </div>
              <div className="text-center pl-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block mb-0.5 truncate">
                  {eventB.name}
                </span>
                <span className="text-2xl font-black text-amber-800">{missingB}</span>
                <span className="text-[10px] font-bold text-amber-700/70 block">faltantes</span>
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Cantidad Total */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-neutral-900">Cantidad Total Evaluada</h4>
                  <p className="text-[11px] font-medium text-neutral-400">Presentes y faltantes</p>
                </div>
              </div>
              {renderDiffBadge(diffTotal, false)}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-neutral-50/70 p-3.5 rounded-2xl border border-neutral-100">
              <div className="text-center border-r border-neutral-200/70 pr-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-0.5 truncate">
                  {eventA.name}
                </span>
                <span className="text-2xl font-black text-neutral-800">{totalA}</span>
                <span className="text-[10px] font-bold text-neutral-400 block">total</span>
              </div>
              <div className="text-center pl-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700 block mb-0.5 truncate">
                  {eventB.name}
                </span>
                <span className="text-2xl font-black text-neutral-800">{totalB}</span>
                <span className="text-[10px] font-bold text-neutral-400 block">total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen amigable de conclusión */}
        <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/60 flex items-center gap-3 text-xs text-neutral-700">
          <div className="w-8 h-8 rounded-xl bg-white text-[#1B4820] flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="font-medium leading-relaxed">
            {diffPresent > 0 
              ? `El segundo evento registró ${diffPresent} presentes más que el primero.`
              : diffPresent < 0
                ? `El segundo evento registró ${Math.abs(diffPresent)} presentes menos que el primero.`
                : 'Ambos eventos registraron exactamente la misma cantidad de animales presentes.'
            }
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
