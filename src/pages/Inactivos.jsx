import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  SlidersHorizontal, 
  Scale, 
  X, 
  CheckCircle2, 
  XCircle, 
  Check, 
  Building2, 
  Dna, 
  Calendar, 
  Menu, 
  SearchX, 
  RefreshCcw,
  Cpu,
  UserCheck,
  Info,
  ScanBarcode,
  LayoutGrid,
  List,
  ChevronRight,
  FileText,
  Pencil,
  CheckSquare,
  UserX,
  Archive,
  AlertTriangle
} from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, clearLocalData } from '@/lib/db';
import { calculateAge, formatWeight, parseLocalDate } from '@/lib/dateUtils';
import { formatGeneticsLabel } from '@/lib/geneticsUtils';
import { logoutUser, isCurrentUserWorker } from '@/lib/authService';
import SyncStatus from '@/components/ui/SyncStatus';
import AnimalImage from '@/components/inventario/AnimalImage';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FarmModal from '@/components/inventario/FarmModal';
import PotreroModal from '@/components/inventario/PotreroModal';
import OwnerModal from '@/components/inventario/OwnerModal';
import BarcodeScannerModal from '@/components/inventario/BarcodeScannerModal';
import NavigationDrawer from '@/components/inventario/NavigationDrawer';
import AnimalCardSkeleton from '@/components/inventario/AnimalCardSkeleton';
import BulkEditModal from '@/components/inventario/BulkEditModal';
import Toast from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useForceResync } from '@/hooks/useForceResync';
import { runFullSync } from '@/lib/syncUtils';

const ITEMS_PER_PAGE = 48;

export const AGE_CATEGORIES = [
  { id: 'Becerro', label: 'Becerros (0 a 12 meses)' },
  { id: 'Maute Macho', label: 'Maute macho (+12 a 36 meses)' },
  { id: 'Maute Hembra', label: 'Maute Hembra (+12 a 24 meses)' },
  { id: 'Novilla', label: 'Novilla (+24 a 36 meses)' },
  { id: 'Adulto', label: 'Adultos Toro/Vaca (+36 meses)' },
  { id: 'Desconocida', label: 'Edad Desconocida' },
];

export const INACTIVITY_REASONS = [
  'Muerte',
  'Venta',
  'Descarte',
  'Pérdida / Extravío'
];

export function getAnimalAgeCategory(animal) {
  if (!animal?.birth_date) return 'Desconocida';
  const birth = parseLocalDate(animal.birth_date);
  if (!birth || isNaN(birth.getTime())) return 'Desconocida';

  const months = (new Date() - birth) / (1000 * 60 * 60 * 24 * 30.44);
  if (months <= 12) return 'Becerro';

  const sex = animal.sex;
  if (sex === 'Macho') {
    if (months <= 36) return 'Maute Macho';
    return 'Adulto';
  }

  if (sex === 'Hembra') {
    if (months <= 24) return 'Maute Hembra';
    if (months <= 36) return 'Novilla';
    return 'Adulto';
  }

  if (months <= 36) return 'Maute Macho';
  return 'Adulto';
}

const FilterCheckbox = ({ label, count, checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className="w-full flex items-center gap-3 py-2.5 cursor-pointer group select-none text-left transition-colors hover:bg-neutral-50 px-2 rounded-xl"
  >
    <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all shrink-0 ${
      checked ? 'bg-[#1B4820] border-[#1B4820]' : 'border-neutral-300 bg-white group-hover:border-[#1B4820]/50'
    }`}>
      {checked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
    </div>
    <span className={`text-sm flex-1 transition-colors ${checked ? 'font-black text-[#1B4820]' : 'font-bold text-neutral-700 group-hover:text-black'}`}>{label}</span>
    {count !== undefined && <span className="text-xs font-bold text-neutral-400">({count})</span>}
  </button>
);

const SearchInput = ({ isMobile = false, searchTerm, setSearchTerm, onOpenFilters, activeFiltersCount, onScanBarcode, onScannedCode }) => {
  const searchScannerRef = useRef({ 
    buffer: '', 
    lastTime: 0, 
    isScanning: false, 
    timer: null 
  });

  const resetScanner = () => {
    if (searchScannerRef.current.timer) {
      clearTimeout(searchScannerRef.current.timer);
      searchScannerRef.current.timer = null;
    }
    searchScannerRef.current.buffer = '';
    searchScannerRef.current.isScanning = false;
  };

  useEffect(() => {
    return () => {
      if (searchScannerRef.current.timer) {
        clearTimeout(searchScannerRef.current.timer);
      }
    };
  }, []);

  const handleSearchScan = (scannedCode) => {
    const clean = (scannedCode || '').trim();
    if (!clean) return;
    setSearchTerm(clean);
    if (onScannedCode) {
      onScannedCode(clean);
    }
  };

  return (
    <div className={`relative flex items-center ${isMobile
      ? 'md:hidden bg-white mt-3 w-full border-neutral-300 shadow-xs'
      : 'hidden md:flex bg-white md:w-full md:max-w-md border-neutral-200 shadow-sm'
      } rounded-2xl py-2 px-4 border focus-within:border-[#1B4820] transition-all`}>

      <Search className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
      <input
        type="text"
        placeholder={isMobile ? "Buscar en bajas e inactivos" : "Buscar por arete, chip, nombre, dueño..."}
        value={searchTerm}
        onChange={(e) => {
          if (!searchScannerRef.current.isScanning) {
            setSearchTerm(e.target.value);
          }
        }}
        onFocus={(e) => {
          e.target.select();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData('text').trim();
          if (pasted) {
            handleSearchScan(pasted);
          }
        }}
        onKeyDown={(e) => {
          const currentTime = Date.now();
          const timeDiff = currentTime - (searchScannerRef.current.lastTime || 0);

          if (e.key === 'Enter') {
            e.preventDefault();
            if (searchScannerRef.current.buffer.length >= 3) {
              handleSearchScan(searchScannerRef.current.buffer);
            }
            resetScanner();
            return;
          }

          if (e.key.length === 1) {
            if (timeDiff < 60) {
              searchScannerRef.current.isScanning = true;
              searchScannerRef.current.buffer += e.key;

              if (searchScannerRef.current.timer) {
                clearTimeout(searchScannerRef.current.timer);
              }
              searchScannerRef.current.timer = setTimeout(() => {
                if (searchScannerRef.current.buffer.length >= 3) {
                  handleSearchScan(searchScannerRef.current.buffer);
                }
                resetScanner();
              }, 120);
            } else {
              searchScannerRef.current.buffer = e.key;
              searchScannerRef.current.isScanning = false;
            }
            searchScannerRef.current.lastTime = currentTime;
          }
        }}
        className="w-full text-sm font-semibold outline-none text-neutral-800 placeholder-neutral-400 bg-transparent"
      />

      <div className="flex items-center gap-1.5 ml-2">
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
            title="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onScanBarcode}
          className="p-1.5 rounded-xl text-neutral-400 hover:text-[#1B4820] hover:bg-emerald-50 transition-colors cursor-pointer"
          title="Escanear código de barras o arete con la cámara"
        >
          <ScanBarcode className="w-4 h-4" />
        </button>

        {isMobile && (
          <button
            type="button"
            onClick={onOpenFilters}
            className={`p-1.5 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
              activeFiltersCount > 0
                ? 'bg-[#1B4820] text-white border-[#1B4820]'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
            title="Filtros"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-xs">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default function Inactivos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPotreroModalOpen, setIsPotreroModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  // Modo de visualización: Tarjetas ("grid") o Lista Compacta ("list")
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('ganadera_inactivos_view_mode') || 'grid';
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('ganadera_inactivos_view_mode', mode);
  };

  // --- SELECCIÓN MÚLTIPLE DE ANIMALES ---
  const [selectedAnimalIds, setSelectedAnimalIds] = useState(new Set());
  const longPressTimerRef = useRef(null);
  const isLongPressTriggeredRef = useRef(false);

  const toggleSelectAnimal = (animalId) => {
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
      try { navigator.vibrate(40); } catch { /* ignore */ }
    }
    setSelectedAnimalIds(prev => {
      const next = new Set(prev);
      if (next.has(animalId)) {
        next.delete(animalId);
      } else {
        next.add(animalId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedAnimalIds(new Set());
  };

  const handleTouchStart = (animalId) => {
    isLongPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      toggleSelectAnimal(animalId);
    }, 500);
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCardClick = (animalId, e) => {
    if (isLongPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressTriggeredRef.current = false;
      return;
    }

    if (selectedAnimalIds.size > 0) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelectAnimal(animalId);
    }
  };

  const handleCheckboxClick = (animalId, e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSelectAnimal(animalId);
  };

  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isToastOpen, setIsToastOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastOpen(true);
  };

  // Logout Flow
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [pendingLogoutCount, setPendingLogoutCount] = useState(0);

  // Hook de sincronización forzada
  const { forceResync, isResyncing, resyncSuccess } = useForceResync();

  // Filtros avanzados
  const [selectedFarmFilter, setSelectedFarmFilter] = useState('ALL');
  const [selectedPotreroFilter, setSelectedPotreroFilter] = useState('ALL');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('ALL');

  // Identificación del usuario y rol
  const isWorker = isCurrentUserWorker();
  const currentUserId = localStorage.getItem('ganadera_user_id');

  // Datos maestros desde Dexie
  const rawFarms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const rawPotreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray()) || [];
  const rawOwners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];

  // Fincas asignadas si el usuario es obrero
  const assignedFarmIds = useLiveQuery(async () => {
    if (!isWorker || !currentUserId) return null;
    const ufs = await db.usuario_farms
      .where('user_id')
      .equals(currentUserId)
      .filter(uf => !uf.deleted_at)
      .toArray();
    return new Set(ufs.map(uf => uf.farm_id));
  }, [isWorker, currentUserId]);

  const farms = useMemo(() => {
    if (!isWorker || !assignedFarmIds) return rawFarms;
    return rawFarms.filter(f => assignedFarmIds.has(f.id));
  }, [rawFarms, isWorker, assignedFarmIds]);

  const potreros = useMemo(() => {
    if (!isWorker || !assignedFarmIds) return rawPotreros;
    return rawPotreros.filter(p => assignedFarmIds.has(p.farm_id));
  }, [rawPotreros, isWorker, assignedFarmIds]);

  const farmMap = useMemo(() => {
    const map = {};
    rawFarms.forEach(f => { map[f.id] = f.name; });
    return map;
  }, [rawFarms]);

  const potreroMap = useMemo(() => {
    const map = {};
    rawPotreros.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [rawPotreros]);

  const ownerMap = useMemo(() => {
    const map = {};
    rawOwners.forEach(o => { map[o.id] = o.name; });
    return map;
  }, [rawOwners]);

  const executeLogout = async () => {
    try {
      logoutUser();
      await clearLocalData();
      navigate("/login");
    } catch (err) {
      console.error('Error al ejecutar el cierre de sesión:', err);
    }
  };

  const handleLogoutFlow = async () => {
    try {
      let pendingCount = await db.sync_queue.count();
      if (pendingCount > 0 && navigator.onLine) {
        await runFullSync();
        pendingCount = await db.sync_queue.count();
      }
      if (pendingCount > 0) {
        setPendingLogoutCount(pendingCount);
        setIsLogoutConfirmOpen(true);
      } else {
        await executeLogout();
      }
    } catch (err) {
      console.error('Error general durante el cierre de sesión:', err);
    }
  };

  // Filtros locales (SIN status de activo/inactivo, pues todos son inactivos)
  const [filters, setFilters] = useState({
    sex: [],
    reason: [],
    category: [],
    breed: [],
    observations: []
  });

  // CONSULTA PRINCIPAL: Solo animales con status === 'Inactivo'
  const allAnimals = useLiveQuery(
    async () => {
      let animals = await db.animals
        .orderBy('updated_at')
        .reverse()
        .filter(a => !a.deleted_at && a.status === 'Inactivo')
        .toArray();

      if (isWorker && currentUserId) {
        const ufs = await db.usuario_farms
          .where('user_id')
          .equals(currentUserId)
          .filter(uf => !uf.deleted_at)
          .toArray();
        const farmSet = new Set(ufs.map(uf => uf.farm_id));
        animals = animals.filter(a => a.farm_id && farmSet.has(a.farm_id));
      }
      return animals;
    },
    [isWorker, currentUserId]
  );

  const accessibleOwnerIds = useMemo(() => {
    if (!isWorker) return null;
    const set = new Set();
    (allAnimals || []).forEach(a => {
      if (a.owner_id) set.add(a.owner_id);
    });
    return set;
  }, [isWorker, allAnimals]);

  const owners = useMemo(() => {
    if (!isWorker || !accessibleOwnerIds) return rawOwners;
    return rawOwners.filter(o => accessibleOwnerIds.has(o.id));
  }, [isWorker, accessibleOwnerIds, rawOwners]);

  const availableBreeds = useMemo(() => {
    if (!allAnimals) return [];
    const set = new Set();
    allAnimals.forEach(a => {
      const b = (a.breed || '').trim() || 'Sin raza';
      set.add(b);
    });
    return Array.from(set).sort();
  }, [allAnimals]);

  const toggleFilter = (type, value) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(item => item !== value)
        : [...prev[type], value]
    }));
  };

  const clearFilters = () => {
    setFilters({ sex: [], reason: [], category: [], breed: [], observations: [] });
    setSelectedFarmFilter('ALL');
    setSelectedPotreroFilter('ALL');
    setSelectedOwnerFilter('ALL');
  };

  const activeFiltersCount = 
    filters.sex.length + 
    filters.reason.length + 
    filters.category.length + 
    filters.breed.length + 
    filters.observations.length + 
    (selectedFarmFilter !== 'ALL' ? 1 : 0) +
    (selectedPotreroFilter !== 'ALL' ? 1 : 0) +
    (selectedOwnerFilter !== 'ALL' ? 1 : 0);

  const filteredAnimals = useMemo(() => {
    if (!allAnimals) return [];

    return allAnimals.filter(a => {
      const term = searchTerm.toLowerCase().trim();
      const termClean = term.replace(/[\s-]/g, '');
      const animalName = (a.name || '').toLowerCase().trim();
      const animalNum = String(a.number || '').toLowerCase().trim();
      const animalChip = String(a.chip_number || '').toLowerCase().trim();
      const animalOwner = (ownerMap[a.owner_id] || '').toLowerCase().trim();

      const numClean = animalNum.replace(/[\s-]/g, '');
      const chipClean = animalChip.replace(/[\s-]/g, '');

      const matchesSearch = !term || 
        animalNum.includes(term) || 
        (termClean.length > 0 && numClean.includes(termClean)) ||
        animalName.includes(term) || 
        animalChip.includes(term) || 
        (termClean.length > 0 && chipClean.includes(termClean)) ||
        animalOwner.includes(term) || 
        String(a.id || '').toLowerCase().includes(term);
      
      const matchesSex = filters.sex.length === 0 || filters.sex.includes(a.sex);
      
      // Filtro por motivo de inactivación
      const animalReason = a.inactivity_reason || '';
      const matchesReason = filters.reason.length === 0 || filters.reason.some(r => animalReason.toLowerCase().includes(r.toLowerCase()));

      const matchesFarm = selectedFarmFilter === 'ALL' 
        ? true 
        : selectedFarmFilter === 'NONE'
          ? !a.farm_id
          : a.farm_id === selectedFarmFilter;
      const matchesPotrero = selectedPotreroFilter === 'ALL' || a.potrero_id === selectedPotreroFilter;
      const matchesOwner = selectedOwnerFilter === 'ALL' 
        ? true 
        : selectedOwnerFilter === 'NONE'
          ? !a.owner_id
          : a.owner_id === selectedOwnerFilter;
      
      const currentBreed = (a.breed || '').trim() || 'Sin raza';
      const matchesBreed = filters.breed.length === 0 || filters.breed.includes(currentBreed);

      const category = getAnimalAgeCategory(a);
      const matchesCategory = filters.category.length === 0 || filters.category.includes(category);

      const hasObs = Boolean(a.observations && a.observations.trim().length > 0);
      const matchesObservations = filters.observations.length === 0 ||
        (filters.observations.includes('with') && hasObs) ||
        (filters.observations.includes('without') && !hasObs);

      return matchesSearch && matchesSex && matchesReason && matchesCategory && matchesFarm && matchesPotrero && matchesOwner && matchesBreed && matchesObservations;
    });
  }, [allAnimals, searchTerm, filters, selectedFarmFilter, selectedPotreroFilter, selectedOwnerFilter, ownerMap]);

  // Selección de todos los filtrados
  const isAllFilteredSelected = useMemo(() => {
    if (!filteredAnimals || filteredAnimals.length === 0) return false;
    return filteredAnimals.every(a => selectedAnimalIds.has(a.id));
  }, [filteredAnimals, selectedAnimalIds]);

  const handleSelectAllFiltered = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isAllFilteredSelected) {
      setSelectedAnimalIds(prev => {
        const next = new Set(prev);
        filteredAnimals.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedAnimalIds(prev => {
        const next = new Set(prev);
        filteredAnimals.forEach(a => next.add(a.id));
        return next;
      });
    }
  };

  const getCount = (type, value) => {
    if (!allAnimals) return 0;
    return allAnimals.filter(a => {
      if (type === 'sex') return a.sex === value;
      if (type === 'reason') return (a.inactivity_reason || '').toLowerCase().includes(value.toLowerCase());
      if (type === 'breed') return ((a.breed || '').trim() || 'Sin raza') === value;
      if (type === 'category') {
        const cat = getAnimalAgeCategory(a);
        return cat === value;
      }
      if (type === 'observations') {
        const hasObs = Boolean(a.observations && a.observations.trim().length > 0);
        if (value === 'with') return hasObs;
        if (value === 'without') return !hasObs;
      }
      return false;
    }).length;
  };

  const counts = useMemo(() => {
    if (!filteredAnimals) return { total: 0, hembras: 0, machos: 0 };
    return {
      total: filteredAnimals.length,
      hembras: filteredAnimals.filter(a => a.sex === 'Hembra').length,
      machos: filteredAnimals.filter(a => a.sex === 'Macho').length,
    };
  }, [filteredAnimals]);

  // Paginación reactiva
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil((filteredAnimals?.length || 0) / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, selectedFarmFilter, selectedPotreroFilter, selectedOwnerFilter]);

  const paginatedAnimals = useMemo(() => {
    if (!filteredAnimals) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAnimals.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAnimals, currentPage]);

  const handleScannedChipCode = (scannedCode) => {
    const clean = (scannedCode || '').trim();
    if (!clean) return;
    const match = (allAnimals || []).find(a => 
      (a.chip_number && a.chip_number.trim() === clean) ||
      (a.number && a.number.trim().toLowerCase() === clean.toLowerCase())
    );

    if (match) {
      showToast(`Baja encontrada: Arete #${match.number || 'S/N'}${match.name ? ` (${match.name})` : ''}`, 'success');
    } else {
      showToast(`No se encontró ningún animal inactivo con el código "${clean}".`, 'error');
    }
  };

  const getReasonBadgeStyle = (reasonStr = '') => {
    const lower = reasonStr.toLowerCase();
    if (lower.includes('muerte')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (lower.includes('venta')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (lower.includes('descarte')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (lower.includes('pérdida') || lower.includes('perdida') || lower.includes('extravío') || lower.includes('extravio')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-neutral-100 text-neutral-700 border-neutral-200';
  };

  return (
    <div className="min-h-screen bg-[#F7F7F2] font-sans pb-28 text-neutral-900 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">

        {/* HEADER PRINCIPAL */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-10 h-10 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 shadow-2xs transition-colors cursor-pointer"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5 text-neutral-700" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-none">
                  Animales Inactivos
                </h1>
                <span className="bg-rose-100 text-rose-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-rose-200">
                  {counts.total}
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                Historial de bajas, ventas y retiros del rebaño
              </p>
            </div>
          </div>

          {/* Acciones y Sincronización en Desktop */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-white border border-neutral-200 rounded-2xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => handleViewModeChange('grid')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#1B4820] text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Vista en Tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#1B4820] text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Vista en Lista Compacta"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <SyncStatus />
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y CONTADORES */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-sm mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 max-w-xl">
              <SearchInput
                isMobile={false}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onOpenFilters={() => setIsFilterOpen(true)}
                activeFiltersCount={activeFiltersCount}
                onScanBarcode={() => setIsBarcodeModalOpen(true)}
                onScannedCode={handleScannedChipCode}
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              {/* Contadores por sexo */}
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 bg-neutral-50 px-3 py-2 rounded-2xl border border-neutral-200/80">
                <span className="flex items-center gap-1 text-pink-700">
                  <FaVenus className="w-3.5 h-3.5" />
                  <span>{counts.hembras}</span>
                </span>
                <span className="text-neutral-300">|</span>
                <span className="flex items-center gap-1 text-blue-700">
                  <FaMars className="w-3.5 h-3.5" />
                  <span>{counts.machos}</span>
                </span>
              </div>

              {/* Botón de Filtros Desktop */}
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black border transition-all cursor-pointer ${
                  activeFiltersCount > 0
                    ? 'bg-[#1B4820] text-white border-[#1B4820] shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filtros</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-900 text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Vista Móvil Toggle */}
              <div className="flex sm:hidden items-center bg-neutral-100 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid' ? 'bg-white text-[#1B4820] shadow-xs' : 'text-neutral-400'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('list')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'list' ? 'bg-white text-[#1B4820] shadow-xs' : 'text-neutral-400'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Search input en móvil */}
          <div className="block md:hidden">
            <SearchInput
              isMobile={true}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onOpenFilters={() => setIsFilterOpen(true)}
              activeFiltersCount={activeFiltersCount}
              onScanBarcode={() => setIsBarcodeModalOpen(true)}
              onScannedCode={handleScannedChipCode}
            />
          </div>

          {/* Barra de Selección Masiva (cuando hay seleccionados o cuando se desea seleccionar todos) */}
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isAllFilteredSelected
                    ? 'bg-[#1B4820] text-white border-[#1B4820]'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{isAllFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</span>
              </button>

              {selectedAnimalIds.size > 0 && (
                <span className="font-black text-[#1B4820] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {selectedAnimalIds.size} seleccionados
                </span>
              )}
            </div>

            {selectedAnimalIds.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-neutral-400 hover:text-neutral-700 font-bold transition-colors cursor-pointer"
              >
                Cancelar selección
              </button>
            )}
          </div>

          {/* TAGS DE FILTROS ACTIVOS */}
          {activeFiltersCount > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-neutral-400 font-bold mr-1">Filtros:</span>
              
              {selectedFarmFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-neutral-200">
                  <span>Finca: {selectedFarmFilter === 'NONE' ? 'Sin Finca' : (farmMap[selectedFarmFilter] || 'Finca')}</span>
                  <button type="button" onClick={() => setSelectedFarmFilter('ALL')} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              )}

              {selectedPotreroFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-neutral-200">
                  <span>Potrero: {potreroMap[selectedPotreroFilter] || 'Potrero'}</span>
                  <button type="button" onClick={() => setSelectedPotreroFilter('ALL')} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              )}

              {selectedOwnerFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-neutral-200">
                  <span>Dueño: {selectedOwnerFilter === 'NONE' ? 'Sin Dueño' : (ownerMap[selectedOwnerFilter] || 'Dueño')}</span>
                  <button type="button" onClick={() => setSelectedOwnerFilter('ALL')} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              )}

              {filters.reason.map(r => (
                <span key={r} className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-rose-200">
                  <span>Baja: {r}</span>
                  <button type="button" onClick={() => toggleFilter('reason', r)} className="text-rose-400 hover:text-rose-900 ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}

              {filters.sex.map(s => (
                <span key={s} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300">
                  <span>{s}</span>
                  <button type="button" onClick={() => toggleFilter('sex', s)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}

              {filters.breed.map(b => (
                <span key={b} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300">
                  <span>Raza: {b}</span>
                  <button type="button" onClick={() => toggleFilter('breed', b)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}

              {filters.category.map(c => {
                const catObj = AGE_CATEGORIES.find(ac => ac.id === c);
                return (
                  <span key={c} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300">
                    <span>{catObj ? catObj.label : c}</span>
                    <button type="button" onClick={() => toggleFilter('category', c)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                  </span>
                );
              })}

              <button
                type="button"
                onClick={clearFilters}
                className="text-rose-600 hover:text-rose-800 text-[11px] font-black underline cursor-pointer ml-1"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {/* LISTADO DE ANIMALES INACTIVOS */}
        {allAnimals === undefined ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <AnimalCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAnimals.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-neutral-200/90 shadow-sm max-w-md mx-auto my-12">
            <div className="w-16 h-16 rounded-3xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto mb-4">
              <UserX className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-neutral-800 mb-1">
              No hay animales inactivos
            </h3>
            <p className="text-xs text-neutral-500 font-medium mb-5 leading-relaxed">
              {activeFiltersCount > 0 || searchTerm
                ? 'No se encontraron bajas que coincidan con la búsqueda o filtros aplicados.'
                : 'Todos los animales del inventario se encuentran actualmente activos en el rebaño productivo.'}
            </p>
            {(activeFiltersCount > 0 || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setSearchTerm('');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#1B4820] text-white text-xs font-bold hover:bg-[#143618] transition-colors cursor-pointer"
              >
                Limpiar búsqueda y filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              /* VISTA EN TARJETAS (2 COLUMNAS EN MÓVIL, RESPONSIVA) */
              <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {paginatedAnimals.map((animal) => {
                  const isSelected = selectedAnimalIds.has(animal.id);
                  const isSelectionMode = selectedAnimalIds.size > 0;
                  const reason = animal.inactivity_reason || 'Inactivo';

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={animal.id}
                      onTouchStart={() => handleTouchStart(animal.id)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <Link 
                        to={`/inventario/perfil?id=${animal.id}&from=inactivos`}
                        onClick={(e) => handleCardClick(animal.id, e)}
                        className="block h-full cursor-pointer select-none"
                      >
                        <motion.article 
                          className={`relative group bg-white rounded-2xl sm:rounded-3xl border overflow-hidden flex flex-col h-full transition-all duration-200 shadow-2xs hover:shadow-md ${
                            isSelected 
                              ? 'border-[#1B4820] ring-2 ring-[#1B4820]/40 bg-emerald-50/20' 
                              : 'border-neutral-200/90 hover:border-[#1B4820]/40'
                          }`}
                        >
                          {/* Checkbox en esquina superior izquierda */}
                          <div className="absolute top-2.5 left-2.5 z-20">
                            <button
                              type="button"
                              onClick={(e) => handleCheckboxClick(animal.id, e)}
                              title={isSelected ? "Deseleccionar" : "Seleccionar"}
                              aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#1B4820] border-[#1B4820] text-white opacity-100 shadow-sm'
                                  : isSelectionMode
                                    ? 'bg-white/90 border-neutral-400 opacity-100'
                                    : 'bg-white/80 border-neutral-300 opacity-0 group-hover:opacity-100 hover:border-[#1B4820]'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          </div>

                          {/* Imagen con badge de motivo */}
                          <div className="relative aspect-4/3 w-full bg-neutral-100 overflow-hidden">
                            <AnimalImage 
                              photoUrl={animal.photo_url} 
                              alt={`Animal #${animal.number || 'S/N'}`}
                              className="w-full h-full object-cover filter grayscale contrast-90"
                            />

                            {/* Badge de Motivo de Baja */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-2xs truncate ${getReasonBadgeStyle(reason)}`}>
                                <XCircle className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{reason}</span>
                              </span>
                            </div>
                          </div>

                          {/* Cuerpo de la tarjeta */}
                          <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-base sm:text-lg font-black text-neutral-900 tracking-tight truncate">
                                  {animal.number ? `#${animal.number}` : (animal.name || 'Sin arete')}
                                </span>
                                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  animal.sex === 'Hembra' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {animal.sex === 'Hembra' ? <FaVenus className="w-2.5 h-2.5" /> : <FaMars className="w-2.5 h-2.5" />}
                                  <span>{animal.sex || 'Bovino'}</span>
                                </span>
                              </div>

                              {animal.name && animal.number && (
                                <p className="text-xs font-bold text-neutral-500 truncate mb-1">
                                  {animal.name}
                                </p>
                              )}

                              {animal.chip_number && (
                                <p className="text-[11px] font-medium text-neutral-500 flex items-center gap-1 truncate mb-1">
                                  <Cpu className="w-3 h-3 text-neutral-400 shrink-0" />
                                  <span className="font-mono text-neutral-600">{animal.chip_number}</span>
                                </p>
                              )}

                              <div className="text-[11px] font-medium text-neutral-500 space-y-0.5 mt-2 pt-2 border-t border-neutral-100">
                                <p className="truncate">
                                  <strong>Finca:</strong> {farmMap[animal.farm_id] || 'Sin finca'}
                                </p>
                                {animal.potrero_id && potreroMap[animal.potrero_id] && (
                                  <p className="truncate">
                                    <strong>Potrero:</strong> {potreroMap[animal.potrero_id]}
                                  </p>
                                )}
                                {animal.owner_id && ownerMap[animal.owner_id] && (
                                  <p className="truncate">
                                    <strong>Dueño:</strong> {ownerMap[animal.owner_id]}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Footer de la card: Edad y Observación */}
                            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 pt-2 border-t border-neutral-100 mt-auto">
                              <span>{calculateAge(animal.birth_date)}</span>
                              {Boolean(animal.observations && animal.observations.trim()) && (
                                <span title={animal.observations} className="p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                  <FileText className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.article>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              /* VISTA TIPO LISTA COMPACTA */
              <div className="space-y-2">
                <div className="hidden lg:grid lg:grid-cols-[36px_160px_140px_85px_130px_105px_1fr_130px_24px] gap-3 px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 bg-white/70 rounded-xl border border-neutral-200/60 items-center">
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all cursor-pointer ${
                        isAllFilteredSelected ? 'bg-[#1B4820] border-[#1B4820] text-white' : 'border-neutral-300'
                      }`}
                    >
                      {isAllFilteredSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  </div>
                  <div>Arete / Nombre</div>
                  <div>Microchip</div>
                  <div>Sexo</div>
                  <div>Motivo Baja</div>
                  <div>Edad</div>
                  <div>Campo</div>
                  <div>Dueño</div>
                  <div></div>
                </div>

                {paginatedAnimals.map((animal) => {
                  const isSelected = selectedAnimalIds.has(animal.id);
                  const isSelectionMode = selectedAnimalIds.size > 0;
                  const reason = animal.inactivity_reason || 'Inactivo';

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={animal.id}
                      onTouchStart={() => handleTouchStart(animal.id)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <Link
                        to={`/inventario/perfil?id=${animal.id}&from=inactivos`}
                        onClick={(e) => handleCardClick(animal.id, e)}
                        className={`group block bg-white rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer p-3.5 sm:p-4 select-none ${
                          isSelected 
                            ? 'border-[#1B4820] ring-2 ring-[#1B4820]/40 bg-emerald-50/20' 
                            : 'border-neutral-200/90 hover:border-[#1B4820]/40'
                        }`}
                      >
                        {/* Desktop Layout */}
                        <div className="hidden lg:grid lg:grid-cols-[36px_160px_140px_85px_130px_105px_1fr_130px_24px] gap-3 items-center w-full">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={(e) => handleCheckboxClick(animal.id, e)}
                              className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#1B4820] border-[#1B4820] text-white opacity-100'
                                  : isSelectionMode
                                    ? 'border-neutral-300 opacity-100'
                                    : 'border-neutral-300 opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          </div>

                          <div className="min-w-0">
                            <span className="text-base font-black text-neutral-900 truncate block">
                              {animal.number ? `#${animal.number}` : (animal.name || 'Sin arete')}
                            </span>
                            {animal.name && animal.number && (
                              <span className="text-[11px] font-bold text-neutral-500 truncate block">
                                {animal.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-neutral-600 truncate font-mono">
                            <Cpu className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span>{animal.chip_number || 'Sin chip'}</span>
                          </div>

                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              animal.sex === 'Hembra' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {animal.sex === 'Hembra' ? <FaVenus className="w-2.5 h-2.5" /> : <FaMars className="w-2.5 h-2.5" />}
                              <span>{animal.sex || 'Bovino'}</span>
                            </span>
                          </div>

                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border truncate max-w-[120px] ${getReasonBadgeStyle(reason)}`}>
                              <XCircle className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{reason}</span>
                            </span>
                          </div>

                          <div className="text-xs font-bold text-neutral-600 truncate">
                            {calculateAge(animal.birth_date)}
                          </div>

                          <div className="text-xs text-neutral-600 truncate">
                            {farmMap[animal.farm_id] || 'Sin finca'}
                            {animal.potrero_id && potreroMap[animal.potrero_id] && ` • ${potreroMap[animal.potrero_id]}`}
                          </div>

                          <div className="text-xs font-bold text-neutral-700 truncate">
                            {ownerMap[animal.owner_id] || 'Sin dueño'}
                          </div>

                          <div>
                            <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-black transition-colors" />
                          </div>
                        </div>

                        {/* Mobile Layout */}
                        <div className="flex lg:hidden items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {isSelectionMode && (
                              <button
                                type="button"
                                onClick={(e) => handleCheckboxClick(animal.id, e)}
                                className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-[#1B4820] border-[#1B4820] text-white' : 'border-neutral-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-base font-black text-neutral-900 truncate">
                                  {animal.number ? `#${animal.number}` : (animal.name || 'Sin arete')}
                                </span>
                                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${getReasonBadgeStyle(reason)}`}>
                                  {reason}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-500 font-medium truncate">
                                {farmMap[animal.farm_id] || 'Sin finca'} {ownerMap[animal.owner_id] && `• ${ownerMap[animal.owner_id]}`}
                              </p>
                            </div>
                          </div>

                          <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-bold bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs font-black text-neutral-600 px-3">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-bold bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}

        {/* BARRA FLOTANTE DE ACCIONES MASIVAS */}
        <AnimatePresence>
          {selectedAnimalIds.size > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-6 left-0 right-0 z-50 flex items-center justify-center px-4 pointer-events-none"
            >
              <div className="pointer-events-auto bg-neutral-900/95 backdrop-blur-md text-white rounded-3xl shadow-2xl p-2.5 sm:p-3 flex items-center gap-3 border border-neutral-700/80 max-w-md w-full justify-between">
                <div className="flex items-center gap-2.5 pl-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-500/30">
                    {selectedAnimalIds.size}
                  </div>
                  <span className="text-xs font-black tracking-wide">
                    {selectedAnimalIds.size === 1 ? '1 animal seleccionado' : `${selectedAnimalIds.size} seleccionados`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-3 py-2 rounded-2xl text-xs font-bold text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBulkEditModalOpen(true)}
                    className="px-4 py-2 rounded-2xl text-xs font-black bg-[#1B4820] hover:bg-[#143618] text-white transition-all shadow-md shadow-[#1B4820]/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODAL DE EDICIÓN MASIVA */}
        <BulkEditModal
          isOpen={isBulkEditModalOpen}
          onClose={() => setIsBulkEditModalOpen(false)}
          selectedAnimalIds={selectedAnimalIds}
          farms={farms}
          potreros={potreros}
          owners={owners}
          onSuccess={(updatedCount) => {
            showToast(`${updatedCount} ${updatedCount === 1 ? 'animal actualizado' : 'animales actualizados'} correctamente.`, 'success');
            clearSelection();
          }}
        />

        {/* DRAWER LATERAL DE NAVEGACIÓN */}
        <NavigationDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          farmsCount={farms.length}
          onOpenFarms={() => {
            setIsDrawerOpen(false);
            setIsFarmModalOpen(true);
          }}
          potrerosCount={potreros.length}
          onOpenPotreros={() => {
            setIsDrawerOpen(false);
            setIsPotreroModalOpen(true);
          }}
          ownersCount={owners.length}
          onOpenOwners={() => {
            setIsDrawerOpen(false);
            setIsOwnerModalOpen(true);
          }}
          onForceResync={forceResync}
          isResyncing={isResyncing}
          resyncSuccess={resyncSuccess}
          onLogout={handleLogoutFlow}
        />

        {/* DRAWER DE FILTROS AVANZADOS */}
        <AnimatePresence>
          {isFilterOpen && (
            <div className="fixed inset-0 z-50 overflow-hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
                onClick={() => setIsFilterOpen(false)}
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl z-10 flex flex-col justify-between"
              >
                <div>
                  <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-5 h-5 text-[#1B4820]" />
                      <h3 className="text-base font-black text-neutral-900">Filtros de Bajas</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
                    {/* 1. Finca */}
                    <div>
                      <h4 className="text-xs font-black text-neutral-900 mb-2 uppercase tracking-wider">Finca</h4>
                      <div className="space-y-0.5">
                        <FilterCheckbox
                          label="Todas las Fincas"
                          checked={selectedFarmFilter === 'ALL'}
                          onChange={() => {
                            setSelectedFarmFilter('ALL');
                            setSelectedPotreroFilter('ALL');
                          }}
                        />
                        {farms.map(f => (
                          <FilterCheckbox
                            key={f.id}
                            label={f.name}
                            checked={selectedFarmFilter === f.id}
                            onChange={() => {
                              setSelectedFarmFilter(f.id);
                              setSelectedPotreroFilter('ALL');
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 2. Potrero */}
                    <div>
                      <h4 className="text-xs font-black text-neutral-900 mb-2 uppercase tracking-wider">Potrero</h4>
                      <div className="space-y-0.5">
                        <FilterCheckbox
                          label="Todos los Potreros"
                          checked={selectedPotreroFilter === 'ALL'}
                          onChange={() => setSelectedPotreroFilter('ALL')}
                        />
                        {(selectedFarmFilter === 'ALL' ? potreros : potreros.filter(p => p.farm_id === selectedFarmFilter)).map(p => (
                          <FilterCheckbox
                            key={p.id}
                            label={p.name}
                            checked={selectedPotreroFilter === p.id}
                            onChange={() => setSelectedPotreroFilter(p.id)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 3. Dueño */}
                    <div>
                      <h4 className="text-xs font-black text-neutral-900 mb-2 uppercase tracking-wider">Dueño</h4>
                      <div className="space-y-0.5">
                        <FilterCheckbox
                          label="Todos los Dueños"
                          checked={selectedOwnerFilter === 'ALL'}
                          onChange={() => setSelectedOwnerFilter('ALL')}
                        />
                        {owners.map(o => (
                          <FilterCheckbox
                            key={o.id}
                            label={o.name}
                            checked={selectedOwnerFilter === o.id}
                            onChange={() => setSelectedOwnerFilter(o.id)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 4. Motivo de Inactivación */}
                    <div>
                      <h4 className="text-xs font-black text-neutral-900 mb-2 uppercase tracking-wider">Motivo de Baja</h4>
                      <div className="space-y-0.5">
                        {INACTIVITY_REASONS.map(r => (
                          <FilterCheckbox
                            key={r}
                            label={r}
                            count={getCount('reason', r)}
                            checked={filters.reason.includes(r)}
                            onChange={() => toggleFilter('reason', r)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 5. Género */}
                    <div>
                      <h4 className="text-xs font-black text-neutral-900 mb-2 uppercase tracking-wider">Género</h4>
                      <div className="space-y-0.5">
                        <FilterCheckbox
                          label="Hembras"
                          count={getCount('sex', 'Hembra')}
                          checked={filters.sex.includes('Hembra')}
                          onChange={() => toggleFilter('sex', 'Hembra')}
                        />
                        <FilterCheckbox
                          label="Machos"
                          count={getCount('sex', 'Macho')}
                          checked={filters.sex.includes('Macho')}
                          onChange={() => toggleFilter('sex', 'Macho')}
                        />
                      </div>
                    </div>

                    {/* 6. Categoría / Etapa */}
                    <div>
                      <h4 className="text-xs font-black text-neutral-900 mb-2 uppercase tracking-wider">Etapa Productiva</h4>
                      <div className="space-y-0.5">
                        {AGE_CATEGORIES.map(cat => (
                          <FilterCheckbox
                            key={cat.id}
                            label={cat.label}
                            count={getCount('category', cat.id)}
                            checked={filters.category.includes(cat.id)}
                            onChange={() => toggleFilter('category', cat.id)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 7. Raza */}
                    {availableBreeds.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black text-neutral-900 mb-2 uppercase tracking-wider">Raza</h4>
                        <div className="space-y-0.5">
                          {availableBreeds.map(b => (
                            <FilterCheckbox
                              key={b}
                              label={b}
                              count={getCount('breed', b)}
                              checked={filters.breed.includes(b)}
                              onChange={() => toggleFilter('breed', b)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-neutral-100 flex items-center justify-between gap-3 bg-neutral-50/70">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-black text-neutral-600 hover:bg-neutral-200/60 transition-colors cursor-pointer"
                  >
                    Restablecer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-[#1B4820] text-white hover:bg-[#143618] transition-colors cursor-pointer shadow-md shadow-[#1B4820]/20"
                  >
                    Ver ({filteredAnimals.length})
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modales maestros */}
        <FarmModal isOpen={isFarmModalOpen} onClose={() => setIsFarmModalOpen(false)} />
        <PotreroModal isOpen={isPotreroModalOpen} onClose={() => setIsPotreroModalOpen(false)} />
        <OwnerModal isOpen={isOwnerModalOpen} onClose={() => setIsOwnerModalOpen(false)} />
        <BarcodeScannerModal
          isOpen={isBarcodeModalOpen}
          onClose={() => setIsBarcodeModalOpen(false)}
          onDetected={(code) => {
            setSearchTerm(code);
            handleScannedChipCode(code);
          }}
        />

        {/* Confirm Dialog Logout */}
        <ConfirmDialog
          isOpen={isLogoutConfirmOpen}
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={executeLogout}
          title="Cambios pendientes sin sincronizar"
          message={`Tienes ${pendingLogoutCount} operaciones guardadas localmente que aún no se han subido al servidor. Si cierras sesión ahora, podrían perderse.`}
          confirmText="Cerrar sesión de todos modos"
          cancelText="Permanecer en la app"
        />

        {/* Toast */}
        <Toast
          message={toastMessage}
          type={toastType}
          isOpen={isToastOpen}
          onClose={() => setIsToastOpen(false)}
        />
      </div>
    </div>
  );
}
