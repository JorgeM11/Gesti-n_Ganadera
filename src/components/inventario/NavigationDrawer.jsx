import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

const MotionDiv = motion.div;
import { 
  X, 
  Layers, 
  Building2, 
  Milk, 
  RefreshCcw, 
  LogOut, 
  CheckCircle2, 
  ShieldCheck, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function NavigationDrawer({
  isOpen,
  onClose,
  farmsCount = 0,
  onOpenFarms,
  onOpenMilking,
  onForceResync,
  isResyncing = false,
  resyncSuccess = false,
  onLogout
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const isCurrentRoute = (path) => location.pathname === path;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          {/* Overlay oscuro de fondo */}
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
          />

          {/* Panel Lateral Drawer */}
          <MotionDiv
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-2xl z-10 flex flex-col justify-between"
          >
            {/* Header del Drawer */}
            <div>
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1B4820] flex items-center justify-center text-white shadow-md shadow-[#1B4820]/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-neutral-900 tracking-tight">Ganadera</h2>
                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Gestión & Control</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors cursor-pointer"
                  title="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lista de Enlaces de Navegación */}
              <nav className="p-4 space-y-2">
                {/* 1. Inventario */}
                <button
                  type="button"
                  onClick={() => {
                    navigate('/inventario');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    isCurrentRoute('/inventario')
                      ? 'bg-[#1B4820] text-white shadow-lg shadow-[#1B4820]/20'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Layers className={`w-5 h-5 ${isCurrentRoute('/inventario') ? 'text-white' : 'text-[#1B4820]'}`} />
                    <span>Inventario</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 opacity-50 ${isCurrentRoute('/inventario') ? 'text-white' : 'text-neutral-400'}`} />
                </button>

                {/* 2. Fincas */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenFarms) onOpenFarms();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-neutral-600" />
                    <span>Fincas</span>
                  </div>
                  {farmsCount > 0 && (
                    <span className="text-[10px] font-black bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full">
                      {farmsCount}
                    </span>
                  )}
                </button>

                {/* 3. Ordeño */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenMilking) onOpenMilking();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Milk className="w-5 h-5 text-blue-600" />
                    <span>Ordeño</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/50">
                    Registro
                  </span>
                </button>

                {/* Separador sutil */}
                <div className="my-2 border-t border-neutral-100" />

                {/* 4. Respaldo Forzado */}
                <button
                  type="button"
                  onClick={async () => {
                    if (onForceResync) {
                      await onForceResync();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    resyncSuccess 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {resyncSuccess ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <RefreshCcw className={`w-5 h-5 text-neutral-600 ${isResyncing ? 'animate-spin text-[#1B4820]' : ''}`} />
                    )}
                    <span>
                      {isResyncing ? 'Actualizando...' : resyncSuccess ? '¡Actualizado!' : 'Respaldo Forzado'}
                    </span>
                  </div>
                  {isResyncing && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </button>
              </nav>
            </div>

            {/* Footer con Cerrar Sesión y Versión */}
            <div className="p-4 border-t border-neutral-100 space-y-3 bg-neutral-50/50">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onLogout) onLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-5 h-5 text-red-500" />
                <span>Cerrar Sesión</span>
              </button>

             

              <div className="pt-2.5 border-t border-neutral-200/60 px-2 text-center text-[10.5px] text-neutral-500 font-medium flex items-center justify-center gap-1.5 flex-wrap">
                <span>Diseñado y desarrollado por</span>
                <a
                  href="https://netgenteam.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-neutral-700 hover:text-[#1B4820] cursor-pointer transition-colors group"
                >
                  <img
                    src="/image.png"
                    alt="NetGen Logo"
                    width={18}
                    height={18}
                    className="w-4 h-4 rounded-md object-contain shadow-2xs transition-transform group-hover:scale-105"
                  />
                  <span>NetGen</span>
                </a>
              </div>
            </div>
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
}
