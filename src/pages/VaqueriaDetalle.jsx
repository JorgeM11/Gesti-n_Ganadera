import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
import { 
  ArrowLeft, 
  ScanBarcode, 
  Plus, 
  Search, 
  Trash2, 
  Pencil, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Building2, 
  Calendar, 
  Tag, 
  Cpu, 
  User, 
  Check, 
  FileText, 
  ClipboardCheck, 
  UserX,
  Sparkles,
  Info
} from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { db } from '@/lib/db';
import { 
  addAnimalToVaqueria, 
  removeAnimalFromVaqueria, 
  getPreviousVaqueria, 
  calculateVaqueriaAnalysis,
  updateVaqueria
} from '@/lib/vaqueriaUtils';
import SyncStatus from '@/components/ui/SyncStatus';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Toast from '@/components/ui/Toast';
import BarcodeScannerModal from '@/components/inventario/BarcodeScannerModal';
import ManualAddModal from '@/components/vaqueria/ManualAddModal';
import InactivateAnimalModal from '@/components/vaqueria/InactivateAnimalModal';
import CompleteAnimalModal from '@/components/vaqueria/CompleteAnimalModal';
import VaqueriaModal from '@/components/vaqueria/VaqueriaModal';

export default function VaqueriaDetallePage() {
  const { id: vaqueriaId } = useParams();
  const navigate = useNavigate();

  // Estados de interfaz y pestañas
  const [activeTab, setActiveTab] = useState('presentes'); // 'presentes' | 'faltantes' | 'por_completar'
  const [searchTerm, setSearchTerm] = useState('');
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isEditVaqueriaOpen, setIsEditVaqueriaOpen] = useState(false);
  const [inactivatingAnimal, setInactivatingAnimal] = useState(null);
  const [completingAnimalRecord, setCompletingAnimalRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [toast, setToast] = useState(null);

  // Estado para Banner de Feedback Instantáneo (Audio + Visual)
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success'|'duplicate'|'error', message, icon }

  // Input de escaneo continuo
  const [scanInputValue, setScanInputValue] = useState('');
  const scanInputRef = useRef(null);

  // Buffer físico para lector RFID Bluetooth / USB-OTG
  const rfidBufferRef = useRef({
    buffer: '',
    lastKeyTime: 0,
    timer: null
  });

  const showToast = (title, message, type = 'success') => {
    setToast({ id: Date.now(), title, message, type });
  };

  // Disparar feedback instantáneo visual
  const triggerScanFeedback = (type, message) => {
    setScanFeedback({ type, message, timestamp: Date.now() });
  };

  // Auto-limpiar feedback visual tras 3 segundos
  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => {
      setScanFeedback(null);
    }, 3200);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  // Consultas reactivas Dexie (100% offline-first)
  const currentVaqueria = useLiveQuery(
    () => db.vaquerias.get(vaqueriaId),
    [vaqueriaId]
  );

  const allVaquerias = useLiveQuery(
    () => db.vaquerias.filter(v => !v.deleted_at).toArray()
  ) || [];

  const farm = useLiveQuery(
    () => currentVaqueria?.farm_id ? db.farms.get(currentVaqueria.farm_id) : null,
    [currentVaqueria?.farm_id]
  );

  const presentRecords = useLiveQuery(
    () => db.vaqueria_animals.where('vaqueria_id').equals(vaqueriaId).and(r => !r.deleted_at).toArray(),
    [vaqueriaId]
  ) || [];

  const allAnimals = useLiveQuery(
    () => db.animals.filter(a => !a.deleted_at).toArray()
  ) || [];

  const farmAnimals = useMemo(() => {
    if (!currentVaqueria?.farm_id) return [];
    return allAnimals.filter(a => a.farm_id === currentVaqueria.farm_id);
  }, [allAnimals, currentVaqueria?.farm_id]);

  // Vaquería inmediatamente anterior de la misma finca
  const previousVaqueria = useMemo(() => {
    if (!currentVaqueria) return null;
    return getPreviousVaqueria(currentVaqueria, allVaquerias);
  }, [currentVaqueria, allVaquerias]);

  const previousRecords = useLiveQuery(
    () => previousVaqueria ? db.vaqueria_animals.where('vaqueria_id').equals(previousVaqueria.id).and(r => !r.deleted_at).toArray() : [],
    [previousVaqueria?.id]
  ) || [];

  // Cálculo del análisis de comparación y KPIs
  const analysis = useMemo(() => {
    if (!currentVaqueria) return null;
    return calculateVaqueriaAnalysis({
      currentVaqueria,
      presentRecords,
      previousVaqueria,
      previousRecords,
      farmAnimals,
      allAnimals
    });
  }, [currentVaqueria, presentRecords, previousVaqueria, previousRecords, farmAnimals, allAnimals]);

  // Mantener el input de escaneo siempre enfocado si no hay modales abiertos
  const isAnyModalOpen = isBarcodeOpen || isManualAddOpen || isEditVaqueriaOpen || Boolean(inactivatingAnimal) || Boolean(completingAnimalRecord) || Boolean(deletingRecord);

  const focusScanInput = () => {
    if (!isAnyModalOpen && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  };

  useEffect(() => {
    focusScanInput();
  }, [isAnyModalOpen]);

  // Manejador central para registrar asistencia (venga de input físico, cámara o manual)
  const handleProcessScan = async (code, identificationType = 'auto', manualAnimal = null) => {
    if (!currentVaqueria) return;

    const result = await addAnimalToVaqueria({
      vaqueriaId: currentVaqueria.id,
      farmId: currentVaqueria.farm_id,
      code,
      identificationType,
      manualAnimal
    });

    if (result.success) {
      triggerScanFeedback('success', result.message);
      setScanInputValue('');
    } else {
      if (result.reason === 'DUPLICATE') {
        triggerScanFeedback('duplicate', result.message);
      } else {
        triggerScanFeedback('error', result.message);
      }
    }

    // Volver a enfocar el input de inmediato
    setTimeout(focusScanInput, 60);
    return result;
  };

  // Listener global de cuña de teclado para bastón RFID físico con buffer de 300 ms anti-jitter
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Si el usuario está dentro de otro modal o campo de texto específico que no sea el scan input, no interceptar
      if (isAnyModalOpen) return;
      if (e.target && e.target !== scanInputRef.current && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - rfidBufferRef.current.lastKeyTime;
      rfidBufferRef.current.lastKeyTime = now;

      // Si pasaron más de 300ms entre teclas, reiniciar buffer
      if (timeDiff > 300) {
        rfidBufferRef.current.buffer = '';
      }

      // Si pulsa Enter, procesar buffer acumulado
      if (e.key === 'Enter') {
        if (rfidBufferRef.current.buffer.length >= 2) {
          e.preventDefault();
          const captured = rfidBufferRef.current.buffer.trim();
          rfidBufferRef.current.buffer = '';
          handleProcessScan(captured, 'auto');
        }
        return;
      }

      // Acumular caracteres imprimibles
      if (e.key.length === 1) {
        rfidBufferRef.current.buffer += e.key;

        // Auto-detección: si se completan 15 dígitos numéricos continuos de microchip ganadero ISO
        if (/^\d{15}$/.test(rfidBufferRef.current.buffer)) {
          if (rfidBufferRef.current.timer) clearTimeout(rfidBufferRef.current.timer);
          rfidBufferRef.current.timer = setTimeout(() => {
            const captured = rfidBufferRef.current.buffer.trim();
            rfidBufferRef.current.buffer = '';
            handleProcessScan(captured, 'chip');
          }, 60);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (rfidBufferRef.current.timer) clearTimeout(rfidBufferRef.current.timer);
    };
  }, [isAnyModalOpen, currentVaqueria?.id]);

  // Envío manual desde el input de escaneo
  const handleScanInputSubmit = (e) => {
    e.preventDefault();
    if (!scanInputValue.trim()) return;
    handleProcessScan(scanInputValue.trim(), 'auto');
  };

  // Eliminar animal de la vaquería
  const handleConfirmRemove = async () => {
    if (!deletingRecord) return;
    try {
      await removeAnimalFromVaqueria(deletingRecord.id);
      showToast('Animal retirado', 'El animal fue retirado de la asistencia de esta vaquería.', 'success');
    } catch (err) {
      showToast('Error', err.message || 'No se pudo retirar el animal.', 'error');
    } finally {
      setDeletingRecord(null);
    }
  };

  // Cambiar estatus de la vaquería (Finalizada / En progreso)
  const handleToggleStatus = async () => {
    if (!currentVaqueria) return;
    const newStatus = currentVaqueria.status === 'Finalizada' ? 'En progreso' : 'Finalizada';
    try {
      await updateVaqueria(currentVaqueria.id, { status: newStatus });
      showToast(
        newStatus === 'Finalizada' ? 'Vaquería Finalizada' : 'Vaquería Reabierta',
        `El estado se actualizó a "${newStatus}".`,
        'success'
      );
    } catch (err) {
      showToast('Error', err.message || 'No se pudo cambiar el estado.', 'error');
    }
  };

  if (!currentVaqueria) {
    return (
      <div className="min-h-screen bg-[#F0F2EB] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-lg border border-neutral-200">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black text-neutral-900 mb-2">Vaquería no encontrada</h2>
          <p className="text-xs font-medium text-neutral-500 mb-6">
            La sesión solicitada no existe o fue eliminada previamente.
          </p>
          <button
            type="button"
            onClick={() => navigate('/vaquerias')}
            className="w-full py-3 bg-[#1B4820] text-white rounded-2xl text-xs font-black shadow-md cursor-pointer"
          >
            Volver a Vaquerías
          </button>
        </div>
      </div>
    );
  }

  const { classifiedPresent = [], missingAnimals = [], kpis = {} } = analysis || {};

  // Filtrar presentes por término de búsqueda
  const filteredPresent = classifiedPresent.filter(item => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const matchNumber = (item.displayNumber || '').toLowerCase().includes(q);
    const matchChip = (item.displayChip || '').toLowerCase().includes(q);
    const matchName = (item.displayName || '').toLowerCase().includes(q);
    return matchNumber || matchChip || matchName;
  });

  // Filtrar faltantes por término de búsqueda
  const filteredMissing = missingAnimals.filter(item => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const matchNumber = (item.displayNumber || '').toLowerCase().includes(q);
    const matchChip = (item.displayChip || '').toLowerCase().includes(q);
    const matchName = (item.displayName || '').toLowerCase().includes(q);
    return matchNumber || matchChip || matchName;
  });

  // Lista de no registrados para pestaña dedicada
  const uncompletedList = classifiedPresent.filter(i => i.classification === 'UNREGISTERED_IN_SYSTEM');

  return (
    <div className="min-h-screen bg-[#F0F2EB] flex flex-col font-sans select-none pb-28 md:pb-14">
      {/* 1. Header Superior */}
      <header className="bg-white md:bg-[#1B4820] w-full px-4 pt-4 pb-3 md:py-4 md:px-8 border-b border-neutral-200 md:border-none shadow-xs sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/vaquerias')}
              className="p-2 -ml-2 rounded-xl text-neutral-700 md:text-white hover:bg-neutral-100 md:hover:bg-white/10 transition-colors cursor-pointer"
              title="Volver a lista"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-[#1B4820] md:text-emerald-200">
                  <Building2 className="w-3.5 h-3.5" />
                  {farm?.name || 'Finca'}
                </span>
                <span className="text-neutral-300 md:text-white/40">•</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  currentVaqueria.status === 'Finalizada'
                    ? 'bg-neutral-100 text-neutral-700 md:bg-white/20 md:text-white'
                    : 'bg-emerald-100 text-emerald-800 md:bg-white md:text-[#1B4820]'
                }`}>
                  {currentVaqueria.status || 'En progreso'}
                </span>
              </div>
              <h1 className="text-base md:text-xl font-black text-neutral-900 md:text-white tracking-tight leading-tight line-clamp-1">
                {currentVaqueria.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SyncStatus />
            <button
              type="button"
              onClick={() => setIsEditVaqueriaOpen(true)}
              className="p-2 text-neutral-500 md:text-white/80 hover:bg-neutral-100 md:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Editar datos de vaquería"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`px-3 py-1.5 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer ${
                currentVaqueria.status === 'Finalizada'
                  ? 'bg-neutral-100 md:bg-white/20 text-neutral-700 md:text-white hover:bg-neutral-200'
                  : 'bg-[#1B4820] md:bg-white text-white md:text-[#1B4820] hover:bg-[#143618] md:hover:bg-neutral-100'
              }`}
            >
              {currentVaqueria.status === 'Finalizada' ? 'Reabrir' : 'Finalizar'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-4 md:mt-6 flex-1 space-y-4 md:space-y-6">
        
        {/* Banner de Feedback Instantáneo de Escaneo (Audio + Visual) */}
        <AnimatePresence mode="wait">
          {scanFeedback && (
            <MotionDiv
              key={scanFeedback.timestamp}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className={`p-3.5 md:p-4 rounded-2xl shadow-lg border flex items-center justify-between gap-3 ${
                scanFeedback.type === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : scanFeedback.type === 'duplicate'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-rose-600 text-white border-rose-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  {scanFeedback.type === 'success' && <Check className="w-5 h-5 stroke-[3]" />}
                  {scanFeedback.type === 'duplicate' && <AlertTriangle className="w-5 h-5 stroke-[2.5]" />}
                  {scanFeedback.type === 'error' && <XCircle className="w-5 h-5 stroke-[2.5]" />}
                </div>
                <div>
                  <h4 className="text-xs md:text-sm font-black leading-tight">
                    {scanFeedback.type === 'success' && '¡Asistencia Registrada!'}
                    {scanFeedback.type === 'duplicate' && 'Animal Ya Registrado'}
                    {scanFeedback.type === 'error' && 'Error en Registro'}
                  </h4>
                  <p className="text-[11px] md:text-xs font-medium text-white/90">
                    {scanFeedback.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setScanFeedback(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Barra de Escaneo Continuo & Acciones Rápidas (Sticky / Primordial en campo) */}
        <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-neutral-200/80">
          <form onSubmit={handleScanInputSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Input Escaneo Continuo RFID */}
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-neutral-400">
                <Cpu className="w-4 h-4 text-[#1B4820]" />
              </div>
              <input
                ref={scanInputRef}
                type="text"
                value={scanInputValue}
                onChange={(e) => setScanInputValue(e.target.value)}
                placeholder="Esperando escaneo RFID o ingrese arete/chip..."
                autoComplete="off"
                className="w-full pl-10 pr-24 py-3 bg-neutral-50 border-2 border-neutral-200 rounded-2xl text-sm font-black text-neutral-900 placeholder-neutral-400 focus:bg-white focus:border-[#1B4820] focus:ring-4 focus:ring-[#1B4820]/15 outline-none transition-all shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#1B4820] text-white rounded-xl text-xs font-black shadow-xs hover:bg-[#143618] active:scale-95 transition-all cursor-pointer"
              >
                Registrar
              </button>
            </div>

            {/* Botones de Escaneo de Cámara y Manual */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsBarcodeOpen(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700 rounded-2xl text-xs font-black transition-all cursor-pointer"
                title="Escanear código de barras con cámara"
              >
                <ScanBarcode className="w-4 h-4 text-[#1B4820]" />
                <span className="hidden sm:inline">Cámara</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManualAddOpen(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-[#1B4820] border border-emerald-200 rounded-2xl text-xs font-black transition-all cursor-pointer"
                title="Agregar manualmente por arete, chip o nombre"
              >
                <Plus className="w-4 h-4" />
                <span>Manual</span>
              </button>
            </div>
          </form>

          {/* Subtítulo informativo de línea base */}
          <div className="mt-2.5 pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between text-[11px] font-bold text-neutral-400 gap-2">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#1B4820]" />
              {analysis?.isComparisonWithInventory
                ? 'Línea base: Rebaño activo de la finca en inventario (Primera vaquería)'
                : `Línea base: Vaquería anterior (${previousVaqueria?.name || 'Previa'} - ${previousVaqueria?.date || ''})`}
            </span>
            <span className="text-neutral-500 font-black">
              Escáner RFID activo con tolerancia anti-jitter
            </span>
          </div>
        </div>

        {/* Tarjetas de KPIs Consolidados */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* 1. Total Presentes */}
          <div className="bg-white rounded-3xl p-4 md:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Presentes
              </span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#1B4820] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-neutral-900">
                {kpis.totalPresent || 0}
              </span>
              <span className="text-xs font-bold text-neutral-400">
                de {kpis.totalExpected || 0} esp.
              </span>
            </div>
            <div className="mt-2 w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#1B4820] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(kpis.attendanceRate || 0, 100)}%` }}
              />
            </div>
          </div>

          {/* 2. Animales Nuevos (Con Resaltado de No Registrados) */}
          <div className="bg-white rounded-3xl p-4 md:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Nuevos
              </span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-neutral-900">
                {kpis.totalNew || 0}
              </span>
              <span className="text-xs font-bold text-neutral-500">
                cabezas
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-black">
              {kpis.newUnregisteredCount > 0 && (
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  {kpis.newUnregisteredCount} sin registrar
                </span>
              )}
              {kpis.newInVaqueriaCount > 0 && (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {kpis.newInVaqueriaCount} en vaquería
                </span>
              )}
              {kpis.totalNew === 0 && (
                <span className="text-neutral-400 font-medium">Ninguno nuevo</span>
              )}
            </div>
          </div>

          {/* 3. Animales Faltantes */}
          <div className="bg-white rounded-3xl p-4 md:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Faltantes
              </span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-neutral-900">
                {kpis.totalMissing || 0}
              </span>
              <span className="text-xs font-bold text-neutral-500">
                ausentes
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-black">
              {kpis.missingActiveCount > 0 && (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {kpis.missingActiveCount} activos
                </span>
              )}
              {kpis.missingInactiveCount > 0 && (
                <span className="text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
                  {kpis.missingInactiveCount} ya inactivos
                </span>
              )}
              {kpis.totalMissing === 0 && (
                <span className="text-emerald-700 font-bold">100% asistencia</span>
              )}
            </div>
          </div>

          {/* 4. Tasa de Asistencia */}
          <div className="bg-white rounded-3xl p-4 md:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Efectividad
              </span>
              <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-black text-neutral-900">
                {kpis.attendanceRate || 0}%
              </span>
            </div>
            <span className="mt-1 text-[11px] font-bold text-neutral-400">
              del rebaño esperado verificado
            </span>
          </div>
        </div>

        {/* Pestañas de Navegación del Detalle */}
        <div className="bg-white rounded-3xl p-2 border border-neutral-200/80 shadow-xs flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('presentes')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'presentes'
                ? 'bg-[#1B4820] text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Presentes ({classifiedPresent.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faltantes')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'faltantes'
                ? 'bg-[#1B4820] text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Faltantes ({missingAnimals.length})</span>
          </button>

          {uncompletedList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('por_completar')}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'por_completar'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Por Registrar ({uncompletedList.length})</span>
            </button>
          )}
        </div>

        {/* Barra de Búsqueda de la Lista */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Buscar en ${activeTab === 'presentes' ? 'presentes' : activeTab === 'faltantes' ? 'faltantes' : 'por registrar'} por arete, chip o nombre...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200/80 rounded-2xl text-xs font-bold text-neutral-800 placeholder-neutral-400 focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all shadow-xs"
          />
        </div>

        {/* ======================================================== */}
        {/* TAB 1: PRESENTES                                         */}
        {/* ======================================================== */}
        {activeTab === 'presentes' && (
          <div className="space-y-3">
            {filteredPresent.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200/80 shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <h4 className="text-sm font-black text-neutral-800">No hay animales registrados aún</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                  Usa el lector RFID, la cámara o el botón manual para pasar la asistencia.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPresent.map(item => {
                  const isUnregistered = item.classification === 'UNREGISTERED_IN_SYSTEM';
                  return (
                    <div
                      key={item.record.id}
                      className={`bg-white rounded-2xl p-4 border shadow-xs transition-all flex flex-col justify-between ${
                        isUnregistered
                          ? 'border-rose-300 bg-rose-50/20'
                          : 'border-neutral-200/80 hover:border-neutral-300'
                      }`}
                    >
                      <div>
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] border ${item.badgeColor}`}>
                            {item.badgeLabel}
                          </span>

                          {item.displaySex && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-neutral-500">
                              {item.displaySex === 'Macho' ? (
                                <FaMars className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <FaVenus className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              {item.displaySex}
                            </span>
                          )}
                        </div>

                        {/* Arete y Nombre */}
                        <div className="mb-2">
                          <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-[#1B4820] shrink-0" />
                            Arete #{item.displayNumber}
                          </h3>
                          {item.displayName && item.displayName !== 'Sin nombre' && (
                            <p className="text-xs font-bold text-neutral-600 ml-6">
                              {item.displayName}
                            </p>
                          )}
                        </div>

                        {/* Chip RFID */}
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-600 bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-100 mb-2">
                          <Cpu className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{item.displayChip}</span>
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2 mt-1">
                        {isUnregistered ? (
                          <button
                            type="button"
                            onClick={() => setCompletingAnimalRecord(item.record)}
                            className="flex-1 py-1.5 px-3 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Completar Datos
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-400">
                            {item.displayBreed || 'Mestizo'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setDeletingRecord(item.record)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Quitar de esta vaquería"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: FALTANTES                                         */}
        {/* ======================================================== */}
        {activeTab === 'faltantes' && (
          <div className="space-y-3">
            {filteredMissing.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200/80 shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-black text-neutral-800">¡No hay animales faltantes!</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                  Todos los animales esperados de la finca han respondido presente en esta vaquería.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMissing.map(item => {
                  const isInactive = item.isAlreadyInactive;
                  return (
                    <div
                      key={item.animal.id}
                      className={`bg-white rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                        isInactive
                          ? 'border-neutral-200 bg-neutral-50/50 opacity-80'
                          : 'border-amber-300 bg-amber-50/30'
                      }`}
                    >
                      <div>
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] border ${item.badgeColor}`}>
                            {item.badgeLabel}
                          </span>

                          <span className="flex items-center gap-1 text-[11px] font-bold text-neutral-500">
                            {item.displaySex === 'Macho' ? (
                              <FaMars className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <FaVenus className="w-3.5 h-3.5 text-rose-600" />
                            )}
                            {item.displaySex}
                          </span>
                        </div>

                        {/* Arete y Nombre */}
                        <div className="mb-2">
                          <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-amber-600 shrink-0" />
                            Arete #{item.displayNumber}
                          </h3>
                          {item.displayName && item.displayName !== 'Sin nombre' && (
                            <p className="text-xs font-bold text-neutral-600 ml-6">
                              {item.displayName}
                            </p>
                          )}
                        </div>

                        {/* Chip RFID */}
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-600 bg-white/70 px-2.5 py-1.5 rounded-xl border border-neutral-200 mb-2">
                          <Cpu className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{item.displayChip}</span>
                        </div>

                        {isInactive && item.inactivityReason && (
                          <p className="text-[11px] font-bold text-neutral-500 italic bg-neutral-100 p-2 rounded-lg mb-2">
                            Motivo previo: {item.inactivityReason}
                          </p>
                        )}
                      </div>

                      {/* Acciones de Faltantes */}
                      <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between gap-2 mt-1">
                        {!isInactive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setInactivatingAnimal(item.animal)}
                              className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Inactivar Animal
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                showToast(
                                  'Anotado como Faltante',
                                  `El animal Arete #${item.displayNumber} se mantiene activo con ausencia en esta vaquería.`,
                                  'info'
                                );
                              }}
                              className="py-1.5 px-3 bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Dejar como Faltó
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-neutral-400 italic">
                            Ya no pertenece al rebaño activo
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: POR COMPLETAR (UNREGISTERED IN SYSTEM)             */}
        {/* ======================================================== */}
        {activeTab === 'por_completar' && (
          <div className="space-y-3">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs text-rose-900">
                <span className="font-black">Animales Detectados No Registrados:</span> Estos animales fueron escaneados o ingresados durante la vaquería pero no existen aún en la base de datos general. Puedes completar sus datos aquí para registrarlos formalmente en el inventario de esta finca.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {uncompletedList.map(item => (
                <div
                  key={item.record.id}
                  className="bg-white rounded-2xl p-4 border border-rose-300 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 block w-fit mb-2">
                      Pendiente por Registrar
                    </span>

                    <h3 className="text-base font-black text-neutral-900 mb-1">
                      {item.record.number ? `Arete #${item.record.number}` : `Chip ${item.record.chip_number}`}
                    </h3>

                    {item.record.chip_number && (
                      <p className="text-xs font-mono font-bold text-neutral-600 mb-3">
                        Chip RFID: {item.record.chip_number}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCompletingAnimalRecord(item.record)}
                    className="w-full py-2 px-3 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Completar y Registrar Animal
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Escáner de Código de Barras con Cámara */}
      <BarcodeScannerModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        onScanSuccess={(scannedCode) => {
          setIsBarcodeOpen(false);
          handleProcessScan(scannedCode, 'auto');
        }}
      />

      {/* Modal de Agregar Manualmente */}
      <ManualAddModal
        isOpen={isManualAddOpen}
        onClose={() => setIsManualAddOpen(false)}
        farmId={currentVaqueria.farm_id}
        vaqueriaId={currentVaqueria.id}
        onRegister={async ({ code, identificationType, manualAnimal }) => {
          return await handleProcessScan(code, identificationType, manualAnimal);
        }}
      />

      {/* Modal de Edición de Vaquería */}
      <VaqueriaModal
        isOpen={isEditVaqueriaOpen}
        onClose={() => setIsEditVaqueriaOpen(false)}
        initialData={currentVaqueria}
        onSuccess={(updated) => {
          showToast('Vaquería actualizada', `"${updated.name}" guardada exitosamente.`, 'success');
        }}
      />

      {/* Modal de Inactivar Animal Faltante */}
      <InactivateAnimalModal
        isOpen={Boolean(inactivatingAnimal)}
        onClose={() => setInactivatingAnimal(null)}
        animal={inactivatingAnimal}
        onSuccess={(updated) => {
          showToast('Animal Inactivado', `El animal Arete #${updated.number} fue marcado como inactivo.`, 'success');
        }}
      />

      {/* Modal de Completar Datos de Animal No Registrado */}
      <CompleteAnimalModal
        isOpen={Boolean(completingAnimalRecord)}
        onClose={() => setCompletingAnimalRecord(null)}
        vaqueriaAnimal={completingAnimalRecord}
        farmId={currentVaqueria.farm_id}
        onSuccess={(created) => {
          showToast('Animal Registrado', `Arete #${created.number} ha sido registrado e incorporado al inventario.`, 'success');
        }}
      />

      {/* Confirmación para Quitar Animal de la Lista */}
      <ConfirmDialog
        isOpen={Boolean(deletingRecord)}
        title="¿Quitar animal de esta vaquería?"
        message={`¿Estás seguro de quitar al animal ${deletingRecord?.number ? `Arete #${deletingRecord.number}` : (deletingRecord?.chip_number ? `Chip ${deletingRecord.chip_number}` : 'seleccionado')} de la asistencia de esta sesión?`}
        confirmText="Quitar de Vaquería"
        cancelText="Conservar"
        isDestructive={true}
        onConfirm={handleConfirmRemove}
        onCancel={() => setDeletingRecord(null)}
      />

      {/* Toast Feedback */}
      {toast && (
        <Toast
          key={toast.id}
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
