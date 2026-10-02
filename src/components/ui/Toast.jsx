import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 350 }}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-md pointer-events-auto"
        >
          <div className="bg-white rounded-2xl p-4 shadow-2xl border border-emerald-200/80 flex items-start justify-between gap-3 backdrop-blur-md">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-200/60 mt-0.5">
                {toast.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : toast.type === 'info' ? (
                  <Info className="w-5 h-5 text-blue-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </div>

              <div className="min-w-0">
                <h4 className="text-sm font-black text-neutral-900 leading-tight">
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className="text-xs text-neutral-600 font-medium mt-0.5 leading-snug">
                    {toast.message}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors shrink-0 cursor-pointer"
              title="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
