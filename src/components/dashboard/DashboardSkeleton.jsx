import React from 'react';

/**
 * Skeleton loader para el Dashboard.
 * Mantiene la misma geometría y distribución visual que el contenido real,
 * ofreciendo una transición fluida tanto online como offline.
 */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 1. SKELETON: SELECTOR DE FINCA */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-neutral-200 rounded-md w-36" />
          <div className="h-3 bg-neutral-100 rounded-md w-16" />
        </div>
        <div className="flex items-center gap-2 overflow-hidden pb-1 pt-0.5">
          <div className="h-10 bg-neutral-200/90 rounded-2xl w-40 shrink-0" />
          <div className="h-10 bg-neutral-100 rounded-2xl w-36 shrink-0" />
          <div className="h-10 bg-neutral-100 rounded-2xl w-32 shrink-0" />
          <div className="h-10 bg-neutral-100 rounded-2xl w-28 shrink-0" />
        </div>
      </section>

      {/* 2. SKELETON: SUB-FILTROS */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs space-y-3">
        <div className="h-3.5 bg-neutral-200 rounded-md w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-12 bg-neutral-50 rounded-2xl border border-neutral-200/70" />
          <div className="h-12 bg-neutral-50 rounded-2xl border border-neutral-200/70" />
          <div className="h-12 bg-neutral-50 rounded-2xl border border-neutral-200/70" />
        </div>
      </section>

      {/* 3. SKELETON: BLOQUE DE KPIS (3 CARDS) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* KPI 1: Población Total */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-neutral-200 rounded w-24" />
            <div className="w-8 h-8 rounded-xl bg-neutral-100" />
          </div>
          <div className="space-y-2">
            <div className="h-9 bg-neutral-200 rounded-lg w-24" />
            <div className="h-3 bg-neutral-100 rounded w-36" />
          </div>
        </div>

        {/* KPI 2: Distribución por Sexo */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-neutral-200 rounded w-32" />
            <div className="flex -space-x-1">
              <div className="w-6 h-6 rounded-full bg-neutral-100" />
              <div className="w-6 h-6 rounded-full bg-neutral-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="h-16 bg-pink-50/40 rounded-2xl border border-pink-100/60" />
            <div className="h-16 bg-blue-50/40 rounded-2xl border border-blue-100/60" />
          </div>
        </div>

        {/* KPI 3: Control & Identificación */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between space-y-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-neutral-200 rounded w-36" />
            <div className="w-8 h-8 rounded-xl bg-neutral-100" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="h-16 bg-blue-50/40 rounded-2xl border border-blue-100/60" />
            <div className="h-16 bg-neutral-50 rounded-2xl border border-neutral-200/60" />
            <div className="h-16 bg-amber-50/40 rounded-2xl border border-amber-100/60" />
          </div>
        </div>
      </section>

      {/* 4. SKELETON: ESTRUCTURA ETARIA (PIRÁMIDE DEL REBAÑO) */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
        <div className="border-b border-neutral-100 pb-3 space-y-1.5">
          <div className="h-4 bg-neutral-200 rounded-md w-44" />
          <div className="h-3 bg-neutral-100 rounded-md w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/60 space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-3 bg-neutral-200 rounded w-32" />
                <div className="h-4 bg-neutral-200 rounded-full w-9" />
              </div>
              <div className="h-7 bg-neutral-200 rounded-md w-16" />
              <div className="h-2 bg-neutral-200/70 rounded-full w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* 5. SKELETON: RESUMEN DE FINCAS Y POTREROS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumen por Fincas */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-3 space-y-1.5">
            <div className="h-4 bg-neutral-200 rounded-md w-36" />
            <div className="h-3 bg-neutral-100 rounded-md w-48" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl border border-neutral-200/70 bg-neutral-50/50 flex items-center justify-between"
              >
                <div className="space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-36" />
                  <div className="h-3 bg-neutral-100 rounded w-28" />
                </div>
                <div className="h-7 bg-neutral-200 rounded-lg w-12" />
              </div>
            ))}
          </div>
        </section>

        {/* Ocupación de Potreros */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-3 space-y-1.5">
            <div className="h-4 bg-neutral-200 rounded-md w-40" />
            <div className="h-3 bg-neutral-100 rounded-md w-52" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 flex items-center justify-between gap-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-neutral-200 rounded w-28" />
                  <div className="h-1.5 bg-neutral-200/70 rounded-full w-full" />
                </div>
                <div className="h-4 bg-neutral-200 rounded w-16" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 6. SKELETON: DUEÑOS Y RAZAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dueños */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-3 space-y-1.5">
            <div className="h-4 bg-neutral-200 rounded-md w-40" />
            <div className="h-3 bg-neutral-100 rounded-md w-48" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 flex items-center justify-between gap-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-neutral-200 rounded w-28" />
                  <div className="h-1.5 bg-neutral-200/70 rounded-full w-full" />
                </div>
                <div className="h-4 bg-neutral-200 rounded w-16" />
              </div>
            ))}
          </div>
        </section>

        {/* Razas */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-3 space-y-1.5">
            <div className="h-4 bg-neutral-200 rounded-md w-40" />
            <div className="h-3 bg-neutral-100 rounded-md w-48" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 flex items-center justify-between gap-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-neutral-200 rounded w-28" />
                  <div className="h-1.5 bg-neutral-200/70 rounded-full w-full" />
                </div>
                <div className="h-4 bg-neutral-200 rounded w-16" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 7. SKELETON: ACTIVIDAD RECIENTE (TABLA ÚLTIMOS 10) */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
        <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
          <div className="space-y-1.5">
            <div className="h-4 bg-neutral-200 rounded-md w-56" />
            <div className="h-3 bg-neutral-100 rounded-md w-72" />
          </div>
          <div className="h-3.5 bg-neutral-200 rounded w-28" />
        </div>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <div className="min-w-[680px] space-y-2">
            <div className="h-10 bg-neutral-100 rounded-xl" />
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-11 bg-neutral-50/70 rounded-xl border border-neutral-100 flex items-center justify-between px-3.5"
              >
                <div className="space-y-1">
                  <div className="h-4 bg-neutral-200 rounded w-16" />
                  <div className="h-2.5 bg-neutral-200/60 rounded w-20" />
                </div>
                <div className="h-3.5 bg-neutral-200/80 rounded w-28" />
                <div className="h-3.5 bg-neutral-200/80 rounded w-32" />
                <div className="h-3.5 bg-neutral-200/80 rounded w-24" />
                <div className="h-3.5 bg-neutral-200 rounded w-12" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
