import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  ClipboardPlus,
  Info,
  Lock
} from 'lucide-react';
import { db } from '@/lib/db';
import { 
  addAnimalToVaqueria, 
  removeAnimalFromVaqueria, 
  getPreviousVaqueria, 
  calculateVaqueriaAnalysis,
  updateVaqueria,
  isValidChipNumber
} from '@/lib/vaqueriaUtils';
import { playErrorBeep } from '@/lib/audioUtils';
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
  const location = useLocation();

  // Datos pasados opcionalmente por navegación para evitar cualquier parpadeo de carga
  const initialVaqueria = useMemo(() => {
    return (location.state?.vaqueria && location.state.vaqueria.id === vaqueriaId)
      ? location.state.vaqueria
      : undefined;
  }, [location.state?.vaqueria, vaqueriaId]);

  // Estados de interfaz y pestañas
  const [activeTab, setActiveTab] = useState('presentes'); // 'presentes' | 'faltantes' | 'por_completar'
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isEditVaqueriaOpen, setIsEditVaqueriaOpen] = useState(false);
  const [inactivatingAnimal, setInactivatingAnimal] = useState(null);
  const [completingAnimalRecord, setCompletingAnimalRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [toast, setToast] = useState(null);

  // Resetear paginación cuando cambia la pestaña o el término de búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

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
  const isProcessingScanRef = useRef(false);
  const lastProcessedScanRef = useRef({ code: '', time: 0 });

  const clearAllScanInputs = () => {
    setScanInputValue('');
    if (scanInputRef.current) {
      scanInputRef.current.value = '';
    }
    rfidBufferRef.current.buffer = '';
    if (rfidBufferRef.current.timer) {
      clearTimeout(rfidBufferRef.current.timer);
      rfidBufferRef.current.timer = null;
    }
  };

  const showToast = (title, message, type = 'success') => {
    setToast({ id: Date.now(), title, message, type });
  };

  // Disparar feedback instantáneo visual
  const triggerScanFeedback = (type, message) => {
    setScanFeedback({ type, message, timestamp: Date.now() });
  };

  // Auto-limpiar feedback visual tras 1.6 segundos para que dure poco en pantalla
  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => {
      setScanFeedback(null);
    }, 1600);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  // Consultas reactivas Dexie (100% offline-first)
  const currentVaqueria = useLiveQuery(
    async () => {
      if (!vaqueriaId) return null;
      let v = await db.vaquerias.get(vaqueriaId);
      // En caso de navegación inmediata tras creación o micro-retraso de I/O en IndexedDB
      if (!v) {
        await new Promise(r => setTimeout(r, 120));
        v = await db.vaquerias.get(vaqueriaId);
      }
      if (!v || v.deleted_at) return null;
      return v;
    },
    [vaqueriaId],
    initialVaqueria
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
      scanInputRef.current.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    focusScanInput();

    const handleDocumentPointerDown = (e) => {
      if (isAnyModalOpen) return;
      // No reenfocar si el usuario hace clic o tap en un elemento interactivo explícito
      const interactive = e.target.closest('button, a, input, select, textarea, [role="button"]');
      if (!interactive) {
        focusScanInput();
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown);
  }, [isAnyModalOpen]);

  // Manejador central para registrar asistencia (venga de input físico, cámara o manual)
  const handleProcessScan = async (code, identificationType = 'chip', manualAnimal = null) => {
    if (!currentVaqueria || currentVaqueria.status === 'Finalizada') return;

    const clean = (code || '').trim();
    if (!clean && !manualAnimal) {
      clearAllScanInputs();
      return;
    }

    const now = Date.now();
    // 1. Antirrebote estricto: Si el mismo código se procesó hace menos de 1200 ms
    // (ej. disparo simultáneo por detección de 15 dígitos + tecla Enter de hardware):
    if (clean && clean === lastProcessedScanRef.current.code && (now - lastProcessedScanRef.current.time) < 1200) {
      clearAllScanInputs();
      return;
    }

    // 2. Candado de concurrencia: evitar carreras asíncronas
    if (isProcessingScanRef.current) {
      clearAllScanInputs();
      return;
    }
    isProcessingScanRef.current = true;
    lastProcessedScanRef.current = { code: clean, time: now };

    // Limpiar inmediatamente el input y los buffers antes de la consulta
    clearAllScanInputs();

    let result;
    try {
      result = await addAnimalToVaqueria({
        vaqueriaId: currentVaqueria.id,
        farmId: currentVaqueria.farm_id,
        code: clean,
        identificationType,
        manualAnimal
      });

      if (result.success) {
        triggerScanFeedback('success', result.message);
        setCurrentPage(1);
      } else {
        if (result.reason === 'DUPLICATE') {
          triggerScanFeedback('duplicate', result.message);
        } else {
          triggerScanFeedback('error', result.message);
        }
      }
    } catch (err) {
      console.error('[Vaqueria] Error en handleProcessScan:', err);
      triggerScanFeedback('error', 'Ocurrió un error al procesar el animal.');
    } finally {
      // 3. Limpiar SIEMPRE el input y buffers (éxito, duplicado, error o formato inválido)
      clearAllScanInputs();
      isProcessingScanRef.current = false;
      setTimeout(focusScanInput, 60);
    }

    return result;
  };

  const handleProcessScanRef = useRef(handleProcessScan);
  useEffect(() => {
    handleProcessScanRef.current = handleProcessScan;
  });

  // Listener global de cuña de teclado para bastón RFID físico con buffer de 300 ms anti-jitter
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Si la vaquería está finalizada, o el usuario está dentro de otro modal o campo ajeno, no interceptar
      if (isAnyModalOpen || currentVaqueria?.status === 'Finalizada') return;
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

      // Si pulsa Enter en el bastón o teclado RFID
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        if (rfidBufferRef.current.timer) {
          clearTimeout(rfidBufferRef.current.timer);
          rfidBufferRef.current.timer = null;
        }

        const bufferVal = rfidBufferRef.current.buffer.trim();
        const inputVal = (scanInputRef.current?.value || '').trim();
        rfidBufferRef.current.buffer = '';

        const captured = bufferVal.length >= 2 ? bufferVal : inputVal;

        if (captured) {
          clearAllScanInputs();
          // Validación estricta: el lector físico RFID solo debe emitir chips de 15 dígitos
          if (isValidChipNumber(captured)) {
            handleProcessScanRef.current(captured, 'chip');
          } else {
            playErrorBeep();
            triggerScanFeedback('error', 'El escáner solo admite microchips RFID de 15 dígitos. Para arete use el botón Manual.');
            clearAllScanInputs();
            setTimeout(focusScanInput, 60);
          }
        } else {
          clearAllScanInputs();
        }
        return;
      }

      // Acumular caracteres imprimibles
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        rfidBufferRef.current.buffer += e.key;

        // Auto-detección: si se completan 15 dígitos numéricos continuos de microchip ganadero ISO
        if (/^\d{15}$/.test(rfidBufferRef.current.buffer)) {
          if (rfidBufferRef.current.timer) clearTimeout(rfidBufferRef.current.timer);
          rfidBufferRef.current.timer = setTimeout(() => {
            const captured = rfidBufferRef.current.buffer.trim();
            clearAllScanInputs();
            if (captured && isValidChipNumber(captured)) {
              handleProcessScanRef.current(captured, 'chip');
            }
          }, 80);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (rfidBufferRef.current.timer) clearTimeout(rfidBufferRef.current.timer);
    };
  }, [isAnyModalOpen, currentVaqueria?.id, currentVaqueria?.status]);

  // Envío manual desde el input de escaneo (validación estricta: solo chip de 15 dígitos)
  const handleScanInputSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (rfidBufferRef.current.timer) {
      clearTimeout(rfidBufferRef.current.timer);
      rfidBufferRef.current.timer = null;
    }

    const clean = scanInputValue.trim() || (scanInputRef.current?.value || '').trim();
    if (!clean) {
      clearAllScanInputs();
      return;
    }

    if (!isValidChipNumber(clean)) {
      playErrorBeep();
      triggerScanFeedback('error', 'El escáner solo admite número de chip RFID (15 dígitos). Para registrar arete o nombre, use el botón Manual.');
      clearAllScanInputs();
      setTimeout(focusScanInput, 60);
      return;
    }

    handleProcessScan(clean, 'chip');
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
    const isCurrentlyFinalized = currentVaqueria.status === 'Finalizada';
    const newStatus = isCurrentlyFinalized ? 'En progreso' : 'Finalizada';

    try {
      if (newStatus === 'Finalizada') {
        // Tomar fotografía congelada (snapshot) del análisis actual
        const snapshotData = {
          finalized_at: new Date().toISOString(),
          isComparisonWithInventory: Boolean(analysis?.isComparisonWithInventory),
          previousVaqueria: previousVaqueria ? {
            id: previousVaqueria.id,
            name: previousVaqueria.name,
            date: previousVaqueria.date
          } : null,
          classifiedPresent: (analysis?.classifiedPresent || []).map(p => ({
            record: p.record ? {
              id: p.record.id,
              vaqueria_id: p.record.vaqueria_id,
              animal_id: p.record.animal_id,
              number: p.record.number,
              chip_number: p.record.chip_number,
              name: p.record.name,
              is_unregistered: Boolean(p.record.is_unregistered),
              created_at: p.record.created_at
            } : null,
            animal: p.animal ? {
              id: p.animal.id,
              number: p.animal.number,
              chip_number: p.animal.chip_number,
              name: p.animal.name,
              sex: p.animal.sex,
              breed: p.animal.breed,
              status: p.animal.status
            } : null,
            classification: p.classification,
            badgeLabel: p.badgeLabel,
            badgeColor: p.badgeColor,
            displayName: p.displayName,
            displayNumber: p.displayNumber,
            displayChip: p.displayChip,
            displaySex: p.displaySex,
            displayBreed: p.displayBreed
          })),
          missingAnimals: (analysis?.missingAnimals || []).map(m => ({
            animal: m.animal ? {
              id: m.animal.id,
              number: m.animal.number,
              chip_number: m.animal.chip_number,
              name: m.animal.name,
              sex: m.animal.sex,
              breed: m.animal.breed,
              status: m.animal.status,
              inactivity_reason: m.animal.inactivity_reason || null
            } : null,
            isAlreadyInactive: Boolean(m.isAlreadyInactive),
            status: m.status,
            inactivityReason: m.inactivityReason || null,
            displayName: m.displayName,
            displayNumber: m.displayNumber,
            displayChip: m.displayChip,
            displaySex: m.displaySex,
            displayBreed: m.displayBreed,
            badgeLabel: m.badgeLabel,
            badgeColor: m.badgeColor
          })),
          kpis: analysis?.kpis || {}
        };

        await updateVaqueria(currentVaqueria.id, {
          status: 'Finalizada',
          snapshot_data: snapshotData
        });

        showToast(
          'Vaquería Finalizada',
          'La vaquería se cerró exitosamente y todas sus listas quedaron congeladas de forma inmutable.',
          'success'
        );
      } else {
        await updateVaqueria(currentVaqueria.id, {
          status: 'En progreso',
          snapshot_data: null
        });

        showToast(
          'Vaquería Reabierta',
          'La sesión está de nuevo en progreso y reactiva.',
          'success'
        );
      }
    } catch (err) {
      showToast('Error', err.message || 'No se pudo cambiar el estado.', 'error');
    }
  };

  const isFinalized = currentVaqueria?.status === 'Finalizada';
  const { classifiedPresent = [], missingAnimals = [], kpis = {} } = analysis || {};

  // Filtrar presentes por término de búsqueda (siempre de primero los nuevos no registrados)
  const filteredPresent = useMemo(() => {
    return classifiedPresent
      .filter(item => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        const matchNumber = (item.displayNumber || '').toLowerCase().includes(q);
        const matchChip = (item.displayChip || '').toLowerCase().includes(q);
        const matchName = (item.displayName || '').toLowerCase().includes(q);
        return matchNumber || matchChip || matchName;
      })
      .sort((a, b) => {
        const aIsUnreg = a.classification === 'UNREGISTERED_IN_SYSTEM' ? 1 : 0;
        const bIsUnreg = b.classification === 'UNREGISTERED_IN_SYSTEM' ? 1 : 0;
        if (aIsUnreg !== bIsUnreg) {
          return bIsUnreg - aIsUnreg; // Nuevos no registrados siempre primero
        }
        const timeA = new Date(a.record?.created_at || 0).getTime();
        const timeB = new Date(b.record?.created_at || 0).getTime();
        return timeB - timeA;
      });
  }, [classifiedPresent, searchTerm]);

  // Filtrar faltantes por término de búsqueda
  const filteredMissing = useMemo(() => {
    return missingAnimals.filter(item => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.trim().toLowerCase();
      const matchNumber = (item.displayNumber || '').toLowerCase().includes(q);
      const matchChip = (item.displayChip || '').toLowerCase().includes(q);
      const matchName = (item.displayName || '').toLowerCase().includes(q);
      return matchNumber || matchChip || matchName;
    });
  }, [missingAnimals, searchTerm]);

  // Lista de no registrados para pestaña dedicada
  const uncompletedList = useMemo(() => {
    return classifiedPresent.filter(i => i.classification === 'UNREGISTERED_IN_SYSTEM');
  }, [classifiedPresent]);

  // Filtrar no registrados por término de búsqueda
  const filteredUncompleted = useMemo(() => {
    return uncompletedList.filter(item => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.trim().toLowerCase();
      const matchNumber = (item.record?.number || '').toLowerCase().includes(q);
      const matchChip = (item.record?.chip_number || '').toLowerCase().includes(q);
      const matchName = (item.record?.name || '').toLowerCase().includes(q);
      return matchNumber || matchChip || matchName;
    });
  }, [uncompletedList, searchTerm]);

  // Cálculos de Paginación para la pestaña activa
  const totalItems = activeTab === 'presentes'
    ? filteredPresent.length
    : activeTab === 'faltantes'
      ? filteredMissing.length
      : filteredUncompleted.length;

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedPresent = useMemo(() => {
    const start = (validPage - 1) * itemsPerPage;
    return filteredPresent.slice(start, start + itemsPerPage);
  }, [filteredPresent, validPage, itemsPerPage]);

  const paginatedMissing = useMemo(() => {
    const start = (validPage - 1) * itemsPerPage;
    return filteredMissing.slice(start, start + itemsPerPage);
  }, [filteredMissing, validPage, itemsPerPage]);

  const paginatedUncompleted = useMemo(() => {
    const start = (validPage - 1) * itemsPerPage;
    return filteredUncompleted.slice(start, start + itemsPerPage);
  }, [filteredUncompleted, validPage, itemsPerPage]);

  // Estado de carga inicial mientras se resuelve la consulta a IndexedDB
  if (currentVaqueria === undefined) {
    return (
      <div className="min-h-screen bg-[#F0F2EB] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1B4820] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-neutral-600">Cargando vaquería...</p>
        </div>
      </div>
    );
  }

  // Si tras la consulta confirmamos que la vaquería no existe o fue borrada
  if (currentVaqueria === null) {
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

  return (
    <div className="min-h-screen bg-[#F0F2EB] flex flex-col font-sans select-none pb-28 md:pb-14">
      {/* 1. Header Superior Limpio (Solo Título y Sincronización) */}
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
            <h1 className="text-base md:text-xl font-black text-neutral-900 md:text-white tracking-tight leading-tight line-clamp-1">
              {currentVaqueria.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <SyncStatus />
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-4 md:mt-6 flex-1 space-y-4 md:space-y-5">
        
        {/* Barra Superior con Datos de la Vaquería y Acciones (De primero en la vista) */}
        <div className="bg-white rounded-3xl p-4 md:p-5 border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
              currentVaqueria.status === 'Finalizada'
                ? 'bg-neutral-200 text-neutral-700'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {currentVaqueria.status || 'En progreso'}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-800 text-xs font-black">
              <Building2 className="w-3.5 h-3.5 text-[#1B4820]" />
              {farm?.name || 'Finca'}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              {currentVaqueria.date || 'Sin fecha'}
            </span>
          </div>

          <div className="w-full sm:w-auto">
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer text-center ${
                currentVaqueria.status === 'Finalizada'
                  ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  : 'bg-[#1B4820] text-white hover:bg-[#143618]'
              }`}
            >
              {currentVaqueria.status === 'Finalizada' ? 'Reabrir Vaquería' : 'Finalizar Vaquería'}
            </button>
          </div>
        </div>

        {/* Banner Flotante Superpuesto de Feedback Instantáneo (No mueve componentes del layout) */}
        <AnimatePresence>
          {scanFeedback && (
            <MotionDiv
              key={scanFeedback.timestamp}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="fixed top-16 md:top-20 left-4 right-4 md:left-auto md:right-8 md:max-w-md z-50 pointer-events-none"
            >
              <div
                className={`p-3 md:p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 pointer-events-auto backdrop-blur-md ${
                  scanFeedback.type === 'success'
                    ? 'bg-emerald-600/95 text-white border-emerald-400 shadow-emerald-900/30'
                    : scanFeedback.type === 'duplicate'
                    ? 'bg-amber-500/95 text-white border-amber-400 shadow-amber-900/30'
                    : 'bg-rose-600/95 text-white border-rose-400 shadow-rose-900/30'
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
                    <p className="text-[11px] font-medium text-white/95">
                      {scanFeedback.message}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScanFeedback(null)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg cursor-pointer shrink-0"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Barra de Escaneo Continuo & Acciones Rápidas (o Banner de Bloqueo si está Finalizada) */}
        {isFinalized ? (
          <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-neutral-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-[#1B4820] flex items-center justify-center shrink-0 shadow-inner">
                <Lock className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-black text-neutral-800">
                  Vaquería Finalizada (Listas Inmutables)
                </h4>
                <p className="text-[11px] font-medium text-neutral-500">
                  Todas las listas de asistencia, faltantes y métricas están congeladas históricamente. Para realizar modificaciones, pulse "Reabrir Vaquería".
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-neutral-200/80">
            <form onSubmit={handleScanInputSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Input Escaneo Continuo RFID (con inputMode='none' para no abrir teclado virtual en móvil/tablet) */}
              <div className="relative flex-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-neutral-400">
                  <Cpu className="w-4 h-4 text-[#1B4820]" />
                </div>
                <input
                  ref={scanInputRef}
                  type="text"
                  inputMode="none"
                  value={scanInputValue}
                  onChange={(e) => setScanInputValue(e.target.value)}
                  placeholder="Esperando escaneo de chip RFID (15 dígitos)..."
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
            </div>
          </div>
        )}

        {/* Tarjetas de KPIs Consolidados (Solo Nombre y Número para respetar 100% el responsive móvil/tablet) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* 1. Total Presentes */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
            <span className="text-[11px] sm:text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
              Presentes
            </span>
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="text-xl sm:text-3xl font-black text-neutral-900">
                {kpis.totalPresent || 0}
              </span>
            </div>
          </div>

          {/* 2. Animales Nuevos */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
            <span className="text-[11px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider block mb-0.5">
              Nuevos
            </span>
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="text-xl sm:text-3xl font-black text-neutral-900">
                {kpis.totalNew || 0}
              </span>
            </div>
          </div>

          {/* 3. Animales Faltantes */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
            <span className="text-[11px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider block mb-0.5">
              Faltantes
            </span>
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="text-xl sm:text-3xl font-black text-neutral-900">
                {kpis.totalMissing || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Detalle (Sin iconos, letras más compactas en móvil) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 border border-neutral-200/80 shadow-xs flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('presentes')}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black tracking-tight sm:tracking-normal transition-all cursor-pointer text-center ${
              activeTab === 'presentes'
                ? 'bg-[#1B4820] text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <span>Presentes ({classifiedPresent.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faltantes')}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black tracking-tight sm:tracking-normal transition-all cursor-pointer text-center ${
              activeTab === 'faltantes'
                ? 'bg-[#1B4820] text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <span>Faltantes ({missingAnimals.length})</span>
          </button>

          {uncompletedList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('por_completar')}
              className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black tracking-tight sm:tracking-normal transition-all cursor-pointer text-center ${
                activeTab === 'por_completar'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <span>Nuevos ({uncompletedList.length})</span>
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
            placeholder={`Buscar en ${activeTab === 'presentes' ? 'presentes' : activeTab === 'faltantes' ? 'faltantes' : 'nuevos'} por arete, chip o nombre...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200/80 rounded-2xl text-xs font-bold text-neutral-800 placeholder-neutral-400 focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all shadow-xs"
          />
        </div>

        {/* ======================================================== */}
        {/* TAB 1: PRESENTES (Estilo Lista Horizontal Compacta)      */}
        {/* ======================================================== */}
        {activeTab === 'presentes' && (
          <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
            {filteredPresent.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <h4 className="text-sm font-black text-neutral-800">No hay animales registrados aún</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                  Usa el lector RFID, la cámara o el botón manual para pasar la asistencia.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {paginatedPresent.map(item => {
                  const isUnregistered = item.classification === 'UNREGISTERED_IN_SYSTEM';
                  return (
                    <div
                      key={item.record.id}
                      className={`px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 transition-colors ${
                        isUnregistered ? 'border-l-4 border-rose-500 bg-rose-50/25 hover:bg-rose-50/40' : 'hover:bg-neutral-50'
                      }`}
                    >
                      {/* Datos Distribuidos Horizontalmente */}
                      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                        {/* Arete y Nombre */}
                        <div className="min-w-[80px] sm:min-w-[120px] shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Tag className={`w-3.5 h-3.5 shrink-0 ${isUnregistered ? 'text-rose-600' : 'text-[#1B4820]'}`} />
                            <span className="text-xs sm:text-sm font-black text-neutral-900 truncate">
                              {item.displayNumber && item.displayNumber !== '---'
                                ? `#${item.displayNumber}`
                                : (item.displayName && item.displayName !== 'Sin nombre' ? item.displayName : 'Sin arete')}
                            </span>
                          </div>
                          {item.displayNumber && item.displayNumber !== '---' && item.displayName && item.displayName !== 'Sin nombre' && (
                            <span className="text-[10px] sm:text-[11px] font-bold text-neutral-500 block truncate">
                              {item.displayName}
                            </span>
                          )}
                        </div>

                        {/* Chip RFID (Visible en móvil y escritorio) */}
                        {item.displayChip && item.displayChip !== '---' && (
                          <div className="flex items-center gap-1 text-[10px] sm:text-xs font-mono font-bold text-neutral-600 bg-neutral-100 px-1.5 sm:px-2 py-0.5 rounded-lg shrink-0">
                            <Cpu className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{item.displayChip}</span>
                          </div>
                        )}

                        {/* Badge de Estado: 'Nuevo' para animales que no estaban en la vaquería previa */}
                        {item.classification === 'NEW_IN_VAQUERIA' && (
                          <div className="shrink-0">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">
                              Nuevo
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Acciones al Final */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isUnregistered && !isFinalized && (
                          <button
                            type="button"
                            onClick={() => setCompletingAnimalRecord(item.record)}
                            className="py-1 px-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-[11px] font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                            title="Completar y registrar animal"
                          >
                            <ClipboardPlus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Completar</span>
                          </button>
                        )}

                        {!isFinalized && (
                          <button
                            type="button"
                            onClick={() => setDeletingRecord(item.record)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Quitar de esta vaquería"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
        {/* TAB 2: FALTANTES (Estilo Lista Horizontal Compacta)      */}
        {/* ======================================================== */}
        {activeTab === 'faltantes' && (
          <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
            {filteredMissing.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-black text-neutral-800">¡No hay animales faltantes!</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                  Todos los animales esperados de la finca han respondido presente en esta vaquería.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {paginatedMissing.map(item => {
                  const isInactive = item.isAlreadyInactive;
                  return (
                    <div
                      key={item.animal.id}
                      className={`px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 transition-colors ${
                        isInactive ? 'bg-neutral-50/50 opacity-75' : 'hover:bg-amber-50/20'
                      }`}
                    >
                      {/* Datos Distribuidos Horizontalmente */}
                      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                        {/* Arete y Nombre */}
                        <div className="min-w-[80px] sm:min-w-[120px] shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="text-xs sm:text-sm font-black text-neutral-900 truncate">
                              #{item.displayNumber}
                            </span>
                          </div>
                          {item.displayName && item.displayName !== 'Sin nombre' && (
                            <span className="text-[10px] sm:text-[11px] font-bold text-neutral-500 block truncate">
                              {item.displayName}
                            </span>
                          )}
                        </div>

                        {/* Chip RFID (Visible en móvil y escritorio) */}
                        {item.displayChip && item.displayChip !== '---' && (
                          <div className="flex items-center gap-1 text-[10px] sm:text-xs font-mono font-bold text-neutral-600 bg-neutral-100 px-1.5 sm:px-2 py-0.5 rounded-lg shrink-0">
                            <Cpu className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{item.displayChip}</span>
                          </div>
                        )}
                      </div>

                      {/* Acciones al Final */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isInactive ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-lg">
                            Inactivo
                          </span>
                        ) : (
                          !isFinalized && (
                            <button
                              type="button"
                              onClick={() => setInactivatingAnimal(item.animal)}
                              className="py-1 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Inactivar</span>
                            </button>
                          )
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
        {/* TAB 3: NUEVOS (UNREGISTERED IN SYSTEM)                    */}
        {/* ======================================================== */}
        {activeTab === 'por_completar' && (
          <div className="bg-white rounded-3xl border border-rose-200 shadow-xs overflow-hidden">
            <div className="p-3.5 sm:p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <ClipboardPlus className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs text-rose-900">
                <span className="font-black">Animales Nuevos Detectados:</span> Completa los datos de estos animales para ingresarlos formalmente al inventario.
              </div>
            </div>

            {filteredUncompleted.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold text-neutral-400">
                No se encontraron animales nuevos con el término de búsqueda.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {paginatedUncompleted.map(item => (
                  <div
                    key={item.record.id}
                    className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 border-l-4 border-rose-500 bg-rose-50/20 hover:bg-rose-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <span className="text-xs sm:text-sm font-black text-neutral-900 min-w-[80px] sm:min-w-[120px] shrink-0 truncate">
                        {item.record.name 
                          ? item.record.name 
                          : (item.record.number ? `Arete #${item.record.number}` : 'Sin arete')}
                      </span>

                      {item.record.chip_number && (
                        <span className="inline-block text-[10px] sm:text-xs font-mono font-bold text-neutral-600 bg-neutral-100 px-1.5 sm:px-2 py-0.5 rounded-lg shrink-0">
                          {item.record.chip_number}
                        </span>
                      )}
                    </div>

                    {!isFinalized && (
                      <button
                        type="button"
                        onClick={() => setCompletingAnimalRecord(item.record)}
                        className="py-1 px-3 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <ClipboardPlus className="w-3.5 h-3.5" />
                        <span>Completar</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Controles de Paginación */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-4 py-3 sm:px-6 sm:py-3.5 rounded-2xl sm:rounded-3xl border border-neutral-200/80 shadow-xs gap-3">
            <div className="flex items-center justify-between w-full sm:w-auto gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 280, behavior: 'smooth' });
                }}
                disabled={validPage === 1}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-neutral-100 text-neutral-700 font-black text-xs rounded-xl disabled:opacity-40 transition-colors hover:bg-neutral-200 cursor-pointer disabled:cursor-not-allowed"
              >
                Anterior
              </button>

              <span className="text-xs font-black text-neutral-600 sm:hidden">
                Pág. {validPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 280, behavior: 'smooth' });
                }}
                disabled={validPage === totalPages}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-[#1B4820] text-white font-black text-xs rounded-xl disabled:opacity-40 transition-colors hover:bg-[#143618] cursor-pointer disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
              <div className="text-[11px] sm:text-xs font-bold text-neutral-500">
                Mostrando <span className="font-black text-neutral-800">{Math.min((validPage - 1) * itemsPerPage + 1, totalItems)}</span> - <span className="font-black text-neutral-800">{Math.min(validPage * itemsPerPage, totalItems)}</span> de <span className="font-black text-neutral-800">{totalItems}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500">
                <span className="hidden md:inline">Ver:</span>
                {[25, 50, 100].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setItemsPerPage(size);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                      itemsPerPage === size
                        ? 'bg-[#1B4820] text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
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
          const is15 = isValidChipNumber(scannedCode);
          handleProcessScan(scannedCode, is15 ? 'chip' : 'arete');
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
        confirmText="Quitar"
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
