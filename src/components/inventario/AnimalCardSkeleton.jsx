import React from 'react';

export default function AnimalCardSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 min-[460px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-[2rem] overflow-hidden border border-neutral-200 shadow-sm flex flex-col h-full animate-pulse"
        >
          {/* Imagen de carga */}
          <div className="relative aspect-[4/3] w-full bg-neutral-200">
            {/* Badges falsos */}
            <div className="absolute top-3 left-3 w-16 h-5 bg-neutral-300/80 rounded-full" />
            <div className="absolute top-3 right-3 w-16 h-5 bg-neutral-300/80 rounded-full" />
          </div>

          {/* Cuerpo */}
          <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 gap-4">
            <div className="space-y-3">
              {/* Título */}
              <div className="h-6 bg-neutral-200 rounded-lg w-2/3" />

              {/* Filas de metadatos */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-neutral-200 shrink-0" />
                  <div className="h-3.5 bg-neutral-200 rounded w-3/5" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-neutral-200 shrink-0" />
                  <div className="h-3.5 bg-neutral-200 rounded w-1/2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-neutral-200 shrink-0" />
                  <div className="h-3.5 bg-neutral-200 rounded w-2/5" />
                </div>
              </div>
            </div>

            {/* Footer con peso */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <div className="h-7 bg-neutral-200 rounded-xl w-24" />
              <div className="h-7 bg-neutral-200 rounded-xl w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
