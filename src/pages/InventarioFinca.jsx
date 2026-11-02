import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  Copy,
  Search, 
  SlidersHorizontal, 
  Scale, 
  Plus, 
  X, 
  CheckCircle2, 
  XCircle, 
  Check, 
  Building2, 
  Dna, 
  Calendar, 
  Menu, 
  SearchX, 
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
  ShieldAlert
} from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, clearLocalData } from '@/lib/db';
import { calculateAge, formatWeight, parseLocalDate } from '@/lib/dateUtils';
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

// --- COMPONENTE DE CHECKBOX ---
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
        placeholder={isMobile ? "Buscar Animales en la Finca" : "Buscar en la Finca"}
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
          const now = Date.now();
          const diff = now - searchScannerRef.current.lastTime;
          searchScannerRef.current.lastTime = now;

          if (e.key === 'Enter') {
            e.preventDefault();
            if (searchScannerRef.current.timer) {
              clearTimeout(searchScannerRef.current.timer);
              searchScannerRef.current.timer = null;
            }

            const bufferCode = searchScannerRef.current.buffer.trim();
            const inputCode = e.target.value.trim();
            resetScanner();

            const finalCode = bufferCode.length >= 2 ? bufferCode : inputCode;
            if (finalCode) {
              handleSearchScan(finalCode);
            }
            return;
          }

          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (diff > 300 || !searchScannerRef.current.buffer) {
              searchScannerRef.current.buffer = e.key;
              searchScannerRef.current.isScanning = false;
            } else {
              searchScannerRef.current.buffer += e.key;
              if (diff < 100) {
                searchScannerRef.current.isScanning = true;
              }
            }

            if (searchScannerRef.current.timer) {
              clearTimeout(searchScannerRef.current.timer);
            }

            const currentBuf = searchScannerRef.current.buffer.trim();
            if (/^\d{15}$/.test(currentBuf)) {
              searchScannerRef.current.timer = setTimeout(() => {
                handleSearchScan(currentBuf);
                resetScanner();
              }, 50);
              return;
            }

            if (searchScannerRef.current.isScanning) {
              searchScannerRef.current.timer = setTimeout(() => {
                const code = searchScannerRef.current.buffer.trim();
                if (code.length >= 2) {
                  handleSearchScan(code);
                }
                resetScanner();
              }, 280);
            }
          }
        }}
        className="flex-1 bg-transparent border-none outline-none text-neutral-900 font-medium placeholder-neutral-400 text-sm w-full"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm('')}
          className="p-1 text-neutral-400 hover:text-neutral-600 mr-1 cursor-pointer"
          title="Limpiar búsqueda"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onScanBarcode}
        className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-100/90 hover:bg-emerald-200 active:bg-emerald-300 active:scale-95 text-[#1B4820] border border-emerald-300/90 shadow-2xs transition-all cursor-pointer mr-1.5 shrink-0"
        title="Escanear código de barras (chip o arete)"
      >
        <ScanBarcode className="w-4 h-4 stroke-[2.2]" />
      </button>
      <div className="border-l pl-3 ml-1 border-neutral-200 shrink-0 relative">
        <button 
          type="button"
          onClick={onOpenFilters} 
          className="p-1 hover:bg-neutral-100 rounded-lg transition-colors focus:outline-none cursor-pointer"
          title="Filtros"
        >
          <SlidersHorizontal className="w-4 h-4 text-neutral-700" />
          {activeFiltersCount > 0 && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>
      </div>
    </div>
  );
};

export default function InventarioFincaPage() {
  const navigate = useNavigate();
  const { farmId } = useParams();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detección reactiva de Desktop (breakpoint lg: 1024px)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Bloquear scroll de fondo cuando los filtros están abiertos en móvil
  useEffect(() => {
    if (isFilterOpen && !isDesktop) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isFilterOpen, isDesktop]);

  const mobileFilterVariants = {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' }
  };

  const desktopFilterVariants = {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 20, scale: 0.98 }
  };

  // Custom Hook para Respaldo Forzado
  const { isResyncing, resyncSuccess, handleForceSync } = useForceResync();

  // --- ESTADO DE PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [currentPage]);

  // --- ESTADOS PARA CIERRE DE SESIÓN ---
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [pendingLogoutCount, setPendingLogoutCount] = useState(0);

  // --- ESTADOS PARA POTREROS Y DUEÑOS (SIN FILTRO DE FINCA) ---
  const [selectedPotreroFilter, setSelectedPotreroFilter] = useState('ALL');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('ALL');
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPotreroModalOpen, setIsPotreroModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);

  // --- MODO DE VISTA: TARJETAS (cards) O LISTA (list) CON PERSISTENCIA ---
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('ganadera_inventory_view_mode') || 'cards';
    } catch {
      return 'cards';
    }
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('ganadera_inventory_view_mode', mode);
    } catch (e) {
      console.warn('No se pudo guardar la preferencia de vista en localStorage:', e);
    }
  };

  // --- ESTADO PARA NOTIFICACIONES DE CONFIRMACIÓN (TOAST) ---
  const [toast, setToast] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setToast({ id: Date.now(), title, message, type });
  };

  // --- ESTADO Y MANEJO DE SELECCIÓN MÚLTIPLE ---
  const [selectedAnimalIds, setSelectedAnimalIds] = useState(() => new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  const touchTimerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const toggleAnimalSelection = (animalId) => {
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

  const handleTouchStart = (animalId, e) => {
    isLongPressRef.current = false;
    const touch = e.touches[0];
    if (touch) {
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
        try { navigator.vibrate(60); } catch (_) {}
      }
      toggleAnimalSelection(animalId);
    }, 450);
  };

  const handleTouchMove = (e) => {
    if (!touchTimerRef.current) return;
    const touch = e.touches[0];
    if (touch) {
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleCardClick = (animalId, e) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    if (selectedAnimalIds.size > 0) {
      e.preventDefault();
      e.stopPropagation();
      toggleAnimalSelection(animalId);
    }
  };

  const handleCheckboxClick = (animalId, e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAnimalSelection(animalId);
  };

  const handleCancelSelection = () => {
    setSelectedAnimalIds(new Set());
  };

  const isWorker = isCurrentUserWorker();
  const currentUserId = localStorage.getItem('ganadera_user_id');

  // Datos de la Finca actual
  const currentFarm = useLiveQuery(
    () => farmId ? db.farms.get(farmId) : null,
    [farmId]
  );

  // Asignaciones de fincas para el usuario activo (en caso de ser obrero)
  const assignedFarmIds = useLiveQuery(
    async () => {
      if (!isWorker || !currentUserId) return null;
      const ufs = await db.usuario_farms
        .where('user_id')
        .equals(currentUserId)
        .filter(uf => !uf.deleted_at)
        .toArray();
      return new Set(ufs.map(uf => uf.farm_id));
    },
    [isWorker, currentUserId]
  );

  const rawFarms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const rawPotreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray()) || [];
  const rawOwners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];

  const farms = useMemo(() => {
    if (!isWorker || !assignedFarmIds) return rawFarms;
    return rawFarms.filter(f => assignedFarmIds.has(f.id));
  }, [rawFarms, isWorker, assignedFarmIds]);

  // Potreros exclusivos de esta finca
  const farmPotreros = useMemo(() => {
    return rawPotreros.filter(p => p.farm_id === farmId);
  }, [rawPotreros, farmId]);

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

  const [filters, setFilters] = useState({
    duplicates: [],
    sex: [],
    role: [],
    category: [],
    breed: [],
    observations: []
  });

  // Consultar únicamente animales activos de ESTA finca
  const allAnimals = useLiveQuery(
    async () => {
      if (!farmId) return [];
      let animals = await db.animals
        .orderBy('updated_at')
        .reverse()
        .filter(a => !a.deleted_at && (a.status || 'Activo') !== 'Inactivo' && a.farm_id === farmId)
        .toArray();

      if (isWorker && currentUserId) {
        const ufs = await db.usuario_farms
          .where('user_id')
          .equals(currentUserId)
          .filter(uf => !uf.deleted_at)
          .toArray();
        const farmSet = new Set(ufs.map(uf => uf.farm_id));
        if (!farmSet.has(farmId)) {
          return [];
        }
      }

      return animals;
    },
    [farmId, isWorker, currentUserId]
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

  // Detección y agrupamiento de animales duplicados
  const duplicateAnalysis = useMemo(() => {
    if (!allAnimals || allAnimals.length === 0) {
      return {
        duplicateNumbers: new Set(),
        duplicateNames: new Set(),
        animalsWithDupNumber: new Set(),
        animalsWithDupName: new Set(),
        animalsWithDupAny: new Set()
      };
    }

    const numberCounts = new Map();
    const nameCounts = new Map();

    allAnimals.forEach(a => {
      const rawNum = String(a.number || '').trim().toLowerCase();
      if (rawNum && rawNum !== 's/n' && rawNum !== 'sin arete' && rawNum !== '0') {
        numberCounts.set(rawNum, (numberCounts.get(rawNum) || 0) + 1);
      }

      const rawName = String(a.name || '').trim().toLowerCase();
      if (rawName && rawName !== 'sin nombre' && rawName !== 's/n' && rawName.length >= 2) {
        nameCounts.set(rawName, (nameCounts.get(rawName) || 0) + 1);
      }
    });

    const duplicateNumbers = new Set();
    numberCounts.forEach((count, key) => {
      if (count > 1) duplicateNumbers.add(key);
    });

    const duplicateNames = new Set();
    nameCounts.forEach((count, key) => {
      if (count > 1) duplicateNames.add(key);
    });

    const animalsWithDupNumber = new Set();
    const animalsWithDupName = new Set();
    const animalsWithDupAny = new Set();

    allAnimals.forEach(a => {
      const rawNum = String(a.number || '').trim().toLowerCase();
      const hasDupNum = rawNum && duplicateNumbers.has(rawNum);

      const rawName = String(a.name || '').trim().toLowerCase();
      const hasDupName = rawName && duplicateNames.has(rawName);

      if (hasDupNum) animalsWithDupNumber.add(a.id);
      if (hasDupName) animalsWithDupName.add(a.id);
      if (hasDupNum || hasDupName) animalsWithDupAny.add(a.id);
    });

    return {
      duplicateNumbers,
      duplicateNames,
      animalsWithDupNumber,
      animalsWithDupName,
      animalsWithDupAny
    };
  }, [allAnimals]);

  const toggleDuplicateFilter = (val) => {
    setFilters(prev => {
      const cur = prev.duplicates || [];
      if (val === 'any') {
        return {
          ...prev,
          duplicates: cur.includes('any') ? [] : ['any']
        };
      }
      const withoutAny = cur.filter(x => x !== 'any');
      const next = withoutAny.includes(val)
        ? withoutAny.filter(x => x !== val)
        : [...withoutAny, val];
      return {
        ...prev,
        duplicates: next
      };
    });
  };

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
    setFilters({ duplicates: [], sex: [], role: [], category: [], breed: [], observations: [] });
    setSelectedPotreroFilter('ALL');
    setSelectedOwnerFilter('ALL');
  };

  const activeFiltersCount = 
    (filters.duplicates?.length || 0) +
    filters.sex.length + 
    (filters.role?.length || 0) +
    filters.category.length + 
    filters.breed.length + 
    filters.observations.length + 
    (selectedPotreroFilter !== 'ALL' ? 1 : 0) +
    (selectedOwnerFilter !== 'ALL' ? 1 : 0);

  const filteredAnimals = useMemo(() => {
    if (!allAnimals) return [];

    const result = allAnimals.filter(a => {
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
      const currentRole = a.productive_role || 'Cría';
      const matchesRole = !filters.role || filters.role.length === 0 || filters.role.includes(currentRole);
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

      const isDuplicatesFilterActive = filters.duplicates && filters.duplicates.length > 0;
      let matchesDuplicates = true;
      if (isDuplicatesFilterActive) {
        const wantsAny = filters.duplicates.includes('any');
        const wantsNumber = filters.duplicates.includes('number');
        const wantsName = filters.duplicates.includes('name');

        if (wantsAny) {
          matchesDuplicates = duplicateAnalysis.animalsWithDupAny.has(a.id);
        } else if (wantsNumber && wantsName) {
          matchesDuplicates = duplicateAnalysis.animalsWithDupNumber.has(a.id) || duplicateAnalysis.animalsWithDupName.has(a.id);
        } else if (wantsNumber) {
          matchesDuplicates = duplicateAnalysis.animalsWithDupNumber.has(a.id);
        } else if (wantsName) {
          matchesDuplicates = duplicateAnalysis.animalsWithDupName.has(a.id);
        }
      }

      return matchesSearch && matchesSex && matchesRole && matchesCategory && matchesPotrero && matchesOwner && matchesBreed && matchesObservations && matchesDuplicates;
    });

    const isDuplicatesFilterActive = filters.duplicates && filters.duplicates.length > 0;
    if (isDuplicatesFilterActive) {
      result.sort((a, b) => {
        const getGroupKey = (animal) => {
          const rawNum = String(animal.number || '').trim().toLowerCase();
          const hasDupNum = rawNum && duplicateAnalysis.duplicateNumbers.has(rawNum);

          const rawName = String(animal.name || '').trim().toLowerCase();
          const hasDupName = rawName && duplicateAnalysis.duplicateNames.has(rawName);

          const wantsNumber = filters.duplicates.includes('number') || filters.duplicates.includes('any');
          const wantsName = filters.duplicates.includes('name') || filters.duplicates.includes('any');

          if (wantsNumber && hasDupNum) {
            const paddedNum = /^\d+$/.test(rawNum) ? rawNum.padStart(10, '0') : rawNum;
            return `A_num_${paddedNum}`;
          }
          if (wantsName && hasDupName) {
            return `B_name_${rawName}`;
          }
          return `Z_other_${animal.id}`;
        };

        const keyA = getGroupKey(a);
        const keyB = getGroupKey(b);

        if (keyA !== keyB) {
          return keyA.localeCompare(keyB);
        }
        return (a.id || '').localeCompare(b.id || '');
      });
    }

    return result;
  }, [allAnimals, searchTerm, filters, selectedPotreroFilter, selectedOwnerFilter, ownerMap, duplicateAnalysis]);

  // Selección de todos los filtrados
  const isAllFilteredSelected = useMemo(() => {
    if (!filteredAnimals || filteredAnimals.length === 0) return false;
    return filteredAnimals.every(a => selectedAnimalIds.has(a.id));
  }, [filteredAnimals, selectedAnimalIds]);

  const handleSelectAllFiltered = () => {
    setSelectedAnimalIds(prev => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        filteredAnimals.forEach(a => next.delete(a.id));
      } else {
        filteredAnimals.forEach(a => next.add(a.id));
      }
      return next;
    });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, selectedPotreroFilter, selectedOwnerFilter]);

  const totalPages = Math.ceil(filteredAnimals.length / ITEMS_PER_PAGE);
  const paginatedAnimals = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAnimals.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAnimals, currentPage]);

  const getCount = (type, value) => {
    if (!allAnimals) return 0;
    if (type === 'duplicates') {
      if (value === 'any') return duplicateAnalysis.animalsWithDupAny.size;
      if (value === 'number') return duplicateAnalysis.animalsWithDupNumber.size;
      if (value === 'name') return duplicateAnalysis.animalsWithDupName.size;
      return 0;
    }
    return allAnimals.filter(a => {
      if (type === 'sex') return a.sex === value;
      if (type === 'role') return (a.productive_role || 'Cría') === value;
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

  return (
    <main className="min-h-screen bg-[#F0F2EB] font-sans pb-32 relative">

      {/* OVERLAY FONDO OSCURO PARA FILTROS */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 cursor-pointer z-[55]"
            onClick={() => setIsFilterOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR NAVIGATION DRAWER (HAMBURGUESA) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        farmsCount={farms.length}
        onOpenFarms={() => setIsFarmModalOpen(true)}
        potrerosCount={potreros.length}
        onOpenPotreros={() => setIsPotreroModalOpen(true)}
        ownersCount={owners.length}
        onOpenOwners={() => setIsOwnerModalOpen(true)}
        onForceResync={handleForceSync}
        isResyncing={isResyncing}
        resyncSuccess={resyncSuccess}
        onLogout={handleLogoutFlow}
      />

      {/* --- PANEL DE FILTROS ADAPTATIVO (SIN FILTRO DE FINCA) --- */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            variants={isDesktop ? desktopFilterVariants : mobileFilterVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={isDesktop 
              ? { duration: 0.2, ease: "easeOut" }
              : { type: "spring", damping: 28, stiffness: 280 }
            }
            drag={!isDesktop ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (!isDesktop && (info.offset.y > 100 || info.velocity.y > 300)) {
                setIsFilterOpen(false);
              }
            }}
            className="fixed z-[60] bg-white flex flex-col shadow-2xl
                       bottom-0 left-0 w-full max-h-[85vh] rounded-t-[2rem]
                       lg:bottom-auto lg:top-24 lg:right-8 lg:left-auto lg:w-96 lg:h-auto lg:max-h-[calc(100vh-8rem)] lg:rounded-[2rem] lg:border lg:border-neutral-200"
          >
            <div className="w-full flex justify-center pt-3.5 pb-2 lg:hidden cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-neutral-300 rounded-full"></div>
            </div>

            <div className="px-6 pt-2 lg:pt-6 pb-4 flex items-center justify-between border-b border-neutral-100">
              <h3 className="text-xl font-black text-neutral-900">Filtros</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Borrar
                </button>
                <button 
                  type="button"
                  onClick={() => setIsFilterOpen(false)} 
                  className="flex p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 cursor-pointer"
                  title="Cerrar filtros"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* 1. Filtro de Potrero (Directo de esta finca, sin filtro de finca) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Potrero</h4>
                  {selectedPotreroFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedPotreroFilter('ALL')}
                      className="text-[11px] font-bold text-[#1B4820] hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPotreroFilter('ALL')}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedPotreroFilter === 'ALL'
                        ? 'bg-[#1B4820] text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    Todos los potreros {!isWorker && `(${allAnimals?.length || 0})`}
                  </button>
                  {farmPotreros.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic p-2">Esta finca no tiene potreros registrados.</p>
                  ) : (
                    farmPotreros.map(p => {
                      const count = allAnimals?.filter(a => a.potrero_id === p.id).length || 0;
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setSelectedPotreroFilter(p.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            selectedPotreroFilter === p.id
                              ? 'bg-[#1B4820] text-white shadow-xs'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                          }`}
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="opacity-75 ml-2 text-[10px]">({count})</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 2. Filtro por Dueño */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Dueño / Propietario</h4>
                  {selectedOwnerFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedOwnerFilter('ALL')}
                      className="text-[11px] font-bold text-[#1B4820] hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOwnerFilter('ALL')}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedOwnerFilter === 'ALL'
                        ? 'bg-[#1B4820] text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    Todos los Dueños {!isWorker && `(${allAnimals?.length || 0})`}
                  </button>
                  {owners.map(o => {
                    const count = allAnimals?.filter(a => a.owner_id === o.id).length || 0;
                    return (
                      <button
                        type="button"
                        key={o.id}
                        onClick={() => setSelectedOwnerFilter(o.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          selectedOwnerFilter === o.id
                            ? 'bg-[#1B4820] text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <UserCheck className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span className="truncate">{o.name}</span>
                        </div>
                        <span className="opacity-75 ml-2 text-[10px]">({count})</span>
                      </button>
                    );
                  })}
                  {(() => {
                    const sinDuenoCount = allAnimals?.filter(a => !a.owner_id).length || 0;
                    if (sinDuenoCount === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedOwnerFilter('NONE')}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          selectedOwnerFilter === 'NONE'
                            ? 'bg-[#1B4820] text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        <span className="truncate italic text-neutral-500">Sin dueño asignado</span>
                        <span className="opacity-75 ml-2 text-[10px]">({sinDuenoCount})</span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* 3. Filtro por Raza */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider">Raza</h4>
                <div className="space-y-0.5">
                  {availableBreeds.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">No hay razas registradas</p>
                  ) : (
                    availableBreeds.map(b => (
                      <FilterCheckbox
                        key={b}
                        label={b}
                        count={getCount('breed', b)}
                        checked={filters.breed.includes(b)}
                        onChange={() => toggleFilter('breed', b)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 4. Género */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider">Género</h4>
                <div className="space-y-0.5">
                  <FilterCheckbox label="Hembras" count={getCount('sex', 'Hembra')} checked={filters.sex.includes('Hembra')} onChange={() => toggleFilter('sex', 'Hembra')} />
                  <FilterCheckbox label="Machos" count={getCount('sex', 'Macho')} checked={filters.sex.includes('Macho')} onChange={() => toggleFilter('sex', 'Macho')} />
                </div>
              </div>

              {/* Rol Productivo */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#1B4820] stroke-[2.5]" />
                  <span>Rol Productivo</span>
                </h4>
                <div className="space-y-0.5">
                  <FilterCheckbox label="Cría" count={getCount('role', 'Cría')} checked={filters.role?.includes('Cría')} onChange={() => toggleFilter('role', 'Cría')} />
                  <FilterCheckbox label="Reproductor" count={getCount('role', 'Reproductor')} checked={filters.role?.includes('Reproductor')} onChange={() => toggleFilter('role', 'Reproductor')} />
                </div>
              </div>

              {/* 5. Categoría */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider">Categoría por Edad</h4>
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

              {/* 6. Observaciones */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                  <span>Observaciones</span>
                </h4>
                <div className="space-y-0.5">
                  <FilterCheckbox 
                    label="Con observaciones" 
                    count={getCount('observations', 'with')} 
                    checked={filters.observations.includes('with')} 
                    onChange={() => toggleFilter('observations', 'with')} 
                  />
                  <FilterCheckbox 
                    label="Sin observaciones" 
                    count={getCount('observations', 'without')} 
                    checked={filters.observations.includes('without')} 
                    onChange={() => toggleFilter('observations', 'without')} 
                  />
                </div>
              </div>

              {/* 7. Filtro por Animales Repetidos */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                  <span>Animales Repetidos</span>
                </h4>
                <div className="space-y-0.5">
                  <FilterCheckbox 
                    label="Arete o Nombre repetido" 
                    count={getCount('duplicates', 'any')} 
                    checked={filters.duplicates.includes('any')} 
                    onChange={() => toggleDuplicateFilter('any')} 
                  />
                  <FilterCheckbox 
                    label="Número de arete repetido" 
                    count={getCount('duplicates', 'number')} 
                    checked={filters.duplicates.includes('number')} 
                    onChange={() => toggleDuplicateFilter('number')} 
                  />
                  <FilterCheckbox 
                    label="Nombre repetido" 
                    count={getCount('duplicates', 'name')} 
                    checked={filters.duplicates.includes('name')} 
                    onChange={() => toggleDuplicateFilter('name')} 
                  />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-neutral-100 bg-white lg:rounded-b-[2rem]">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="w-full bg-[#1B4820] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-950 transition-colors shadow-lg shadow-[#1B4820]/20 cursor-pointer"
              >
                {isWorker ? 'Ver Resultados' : `Ver ${filteredAnimals.length} Resultados`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER PRINCIPAL DE INVENTARIO POR FINCA */}
      <header className="bg-white md:bg-[#1B4820] w-full px-4 pt-4 pb-4 md:py-4 md:px-8 sticky top-0 z-30 shadow-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex md:flex-1 items-center justify-between md:justify-start w-full gap-3">
            {/* Botón Volver + Menú Hamburguesa + Título de la Finca */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="p-2.5 rounded-2xl text-[#1B4820] md:text-white hover:bg-[#1B4820]/10 md:hover:bg-white/15 active:scale-95 transition-all cursor-pointer shrink-0"
                title="Abrir menú de navegación"
              >
                <Menu className="w-6 h-6 text-[#1B4820] md:text-white" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-[#1B4820] md:text-white tracking-tight truncate">
                  {currentFarm ? currentFarm.name : 'Inventario de Finca'}
                </h1>
                <p className="text-[10px] md:text-xs font-bold text-neutral-500 md:text-emerald-200 uppercase tracking-widest leading-none truncate">
                  Inventario por Finca
                </p>
              </div>
            </div>

            <div className="md:hidden">
              <SyncStatus />
            </div>
          </div>

          <div className="hidden md:flex md:flex-1 justify-center">
            <SearchInput 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              onOpenFilters={() => setIsFilterOpen(true)} 
              activeFiltersCount={activeFiltersCount} 
              onScanBarcode={() => setIsBarcodeScannerOpen(true)}
              onScannedCode={(code) => showToast('Código escaneado', `Buscando animal con código: ${code}`)}
            />
          </div>

          <div className="hidden md:flex md:flex-1 justify-end">
            <SyncStatus />
          </div>

          <SearchInput 
            isMobile={true} 
            searchTerm={searchTerm} 
            setSearchTerm={setSearchTerm} 
            onOpenFilters={() => setIsFilterOpen(true)} 
            activeFiltersCount={activeFiltersCount} 
            onScanBarcode={() => setIsBarcodeScannerOpen(true)}
            onScannedCode={(code) => showToast('Código escaneado', `Buscando animal con código: ${code}`)}
          />
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-5 md:mt-8 relative z-0">

        {activeFiltersCount > 0 && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200/80 text-emerald-950 p-3 rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B4820]">
                Filtros Activos ({activeFiltersCount})
              </span>
              <button 
                type="button"
                onClick={clearFilters} 
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-emerald-950 hover:bg-emerald-100/70 border border-emerald-300 text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <X className="w-3 h-3 text-emerald-800 stroke-[2.5]" />
                <span>Limpiar todos</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {selectedPotreroFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>Potrero: {potreroMap[selectedPotreroFilter] || 'Seleccionado'}</span>
                  <button type="button" onClick={() => setSelectedPotreroFilter('ALL')} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              )}
              {selectedOwnerFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>Dueño: {selectedOwnerFilter === 'NONE' ? 'Sin dueño' : (ownerMap[selectedOwnerFilter] || 'Seleccionado')}</span>
                  <button type="button" onClick={() => setSelectedOwnerFilter('ALL')} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              )}
              {filters.sex.map(s => (
                <span key={s} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>{s}</span>
                  <button type="button" onClick={() => toggleFilter('sex', s)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}
              {filters.role?.map(r => (
                <span key={r} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>Rol: {r}</span>
                  <button type="button" onClick={() => toggleFilter('role', r)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}
              {filters.breed.map(b => (
                <span key={b} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>Raza: {b}</span>
                  <button type="button" onClick={() => toggleFilter('breed', b)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}
              {filters.category.map(c => {
                const catObj = AGE_CATEGORIES.find(ac => ac.id === c);
                return (
                  <span key={c} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                    <span>{catObj ? catObj.label : c}</span>
                    <button type="button" onClick={() => toggleFilter('category', c)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                  </span>
                );
              })}
              {filters.observations.map(obs => (
                <span key={obs} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>{obs === 'with' ? 'Con observaciones' : 'Sin observaciones'}</span>
                  <button type="button" onClick={() => toggleFilter('observations', obs)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}
              {filters.duplicates.map(d => {
                const label = d === 'any' 
                  ? 'Repetidos: Arete o Nombre' 
                  : d === 'number' 
                    ? 'Repetidos: Arete' 
                    : 'Repetidos: Nombre';
                return (
                  <span key={d} className="inline-flex items-center gap-1 bg-amber-50 text-amber-950 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-amber-300 shadow-2xs">
                    <Copy className="w-3 h-3 text-amber-700 stroke-[2.5]" />
                    <span>{label}</span>
                    <button type="button" onClick={() => toggleDuplicateFilter(d)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ESTADO DE CARGA: SKELETON */}
        {allAnimals === undefined ? (
          <AnimalCardSkeleton count={8} viewMode={viewMode} />
        ) : paginatedAnimals.length > 0 ? (
          <>
            {/* TOOLBAR SUPERIOR: CONTEO DE RESULTADOS Y SELECTOR DE VISTA */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {!isWorker && (
                  <span className="text-xs sm:text-sm font-bold text-neutral-600">
                    <span className="text-neutral-900 font-black">{filteredAnimals.length}</span> {filteredAnimals.length === 1 ? 'animal' : 'animales'}
                    {allAnimals && filteredAnimals.length !== allAnimals.length && (
                      <span className="text-neutral-400 font-medium ml-1">
                        (de {allAnimals.length})
                      </span>
                    )}
                  </span>
                )}

                {/* Si hay animales seleccionados: botón Seleccionar todos / Deseleccionar al lado de la cantidad */}
                {selectedAnimalIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-100 hover:bg-emerald-200 text-[#1B4820] transition-colors cursor-pointer border border-emerald-300/70 shadow-2xs"
                    title={isAllFilteredSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                  >
                    <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isAllFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Selector de modo de vista: Tarjetas vs Lista */}
                <div className="inline-flex items-center bg-white border border-neutral-200/90 rounded-2xl p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'cards'
                        ? 'bg-[#1B4820] text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    }`}
                    title="Vista Cuadrícula / Tarjetas"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
                    <span className="hidden sm:inline">Tarjetas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-[#1B4820] text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    }`}
                    title="Vista Lista (sin imágenes)"
                  >
                    <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
                    <span className="hidden sm:inline">Lista</span>
                  </button>
                </div>
              </div>
            </div>

            {viewMode === 'cards' ? (
              /* GRID DE CARDS ORDENADAS Y PROPORCIONADAS (2 COLUMNAS EN MÓVIL) */
              <motion.div
                layout
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6"
              >
                {paginatedAnimals.map((animal) => {
                  const isSelected = selectedAnimalIds.has(animal.id);
                  const isSelectionMode = selectedAnimalIds.size > 0;

                  const CardContent = (
                    <motion.article 
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className={`relative bg-white rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full cursor-pointer group border-2 ${
                        isSelected 
                          ? 'border-[#1B4820] ring-2 ring-[#1B4820]/40 shadow-md bg-emerald-50/15' 
                          : 'border-neutral-200/80 hover:border-neutral-300'
                      }`}
                    >

                      {/* SECCIÓN DE IMAGEN */}
                      <div className="relative aspect-[4/3] w-full bg-neutral-100 overflow-hidden">
                        <AnimalImage
                          photoPath={animal.photo_path}
                          photoBlob={animal.photo_blob}
                          alt={`Arete #${animal.number}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        {/* Checkbox de Selección Masiva */}
                        <button
                          type="button"
                          onClick={(e) => handleCheckboxClick(animal.id, e)}
                          title={isSelected ? "Deseleccionar animal" : "Seleccionar animal"}
                          aria-label={isSelected ? "Deseleccionar animal" : "Seleccionar animal"}
                          className={`absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer shadow-md ${
                            isSelected
                              ? 'bg-[#1B4820] text-white ring-2 ring-white scale-100 opacity-100'
                              : isSelectionMode
                                ? 'bg-black/45 hover:bg-black/65 text-white backdrop-blur-md border border-white/80 opacity-100'
                                : 'bg-black/45 hover:bg-black/65 text-white backdrop-blur-md border border-white/80 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-[4px] border-[1.5px] border-white/90" />
                          )}
                        </button>

                        {/* Pill de Género (Esquina superior izquierda) */}
                        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 pointer-events-none">
                          <span className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-sm backdrop-blur-xs leading-none shrink-0 ${
                            animal.sex === 'Hembra' ? 'bg-pink-600/90' : 'bg-blue-700/90'
                          }`}>
                            {animal.sex === 'Hembra' ? (
                              <FaVenus className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            ) : (
                              <FaMars className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                            )}
                            <span>{animal.sex || 'Bovino'}</span>
                          </span>
                        </div>

                        {/* Pill de Status (Esquina superior derecha) */}
                        <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 pointer-events-none">
                          <span className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-sm backdrop-blur-xs leading-none shrink-0 ${
                            animal.status === 'Inactivo' ? 'bg-neutral-800/85' : 'bg-emerald-600/90'
                          }`}>
                            {animal.status === 'Inactivo' ? (
                              <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-300 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-200 shrink-0" />
                            )}
                            <span>{animal.status || 'Activo'}</span>
                          </span>
                        </div>
                      </div>

                      {/* SECCIÓN DE INFORMACIÓN */}
                      <div className="p-3 sm:p-5 flex flex-col justify-between flex-1 gap-2 sm:gap-3">
                        <div>
                          {/* Código de Arete */}
                          <div className="mb-1 sm:mb-1.5 flex items-center gap-1.5 flex-wrap">
                            <h2 
                              className="text-base sm:text-lg font-black text-[#1B4820] leading-tight truncate"
                            >
                              {animal.number ? `#${animal.number}` : (animal.name || (animal.chip_number ? `Chip ${animal.chip_number}` : 'Sin arete'))}
                            </h2>
                            {(() => {
                              const rawNum = String(animal.number || '').trim().toLowerCase();
                              const hasDupNum = rawNum && duplicateAnalysis.duplicateNumbers.has(rawNum);
                              const rawName = String(animal.name || '').trim().toLowerCase();
                              const hasDupName = !animal.number && rawName && duplicateAnalysis.duplicateNames.has(rawName);
                              if (hasDupNum || hasDupName) {
                                return (
                                  <span title={hasDupNum ? "Número de arete repetido" : "Nombre repetido"} className="shrink-0 inline-flex items-center">
                                    <Copy className="w-4 h-4 text-orange-500 stroke-[2.5]" />
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* Chip */}
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-neutral-600 py-0.5 truncate">
                            <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate font-bold text-neutral-900">{animal.chip_number || 'Sin chip'}</span>
                          </div>

                          {/* Nombre del animal (si tiene) */}
                          {animal.name && (
                            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-neutral-600 py-0.5 truncate">
                              <span className="truncate font-bold text-neutral-700">"{animal.name}"</span>
                              {(() => {
                                const rawName = String(animal.name || '').trim().toLowerCase();
                                if (rawName && duplicateAnalysis.duplicateNames.has(rawName)) {
                                  return (
                                    <span title="Nombre repetido" className="shrink-0 inline-flex items-center">
                                      <Copy className="w-3.5 h-3.5 text-orange-500 stroke-[2.5]" />
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}

                          {/* Raza */}
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-neutral-700 py-0.5 truncate">
                            <Dna className="w-3.5 h-3.5 text-[#1B4820] shrink-0" />
                            <span className="truncate">{animal.breed || 'Sin raza'}</span>
                          </div>

                          {/* Dueño */}
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-neutral-600 py-0.5 truncate">
                            <UserCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate">
                              Dueño: {animal.owner_id && ownerMap[animal.owner_id] ? ownerMap[animal.owner_id] : 'Sin dueño'}
                            </span>
                          </div>

                          {/* Edad */}
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-neutral-600 py-0.5 truncate">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate">
                              Edad: {calculateAge(animal.birth_date)}
                            </span>
                          </div>
                        </div>

                        {/* Fila Inferior: Peso y Observaciones */}
                        <div className="pt-2 sm:pt-3 border-t border-neutral-100 flex items-center justify-between gap-1 sm:gap-2">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="flex items-center text-neutral-800 bg-neutral-100/90 border border-neutral-200/70 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl">
                              <Scale className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 text-[#1B4820]" strokeWidth={2.5} />
                              <span className="text-[11px] sm:text-xs font-black tracking-tight">{formatWeight(animal.last_weight_kg)}</span>
                            </div>

                            {Boolean(animal.observations && animal.observations.trim()) && (
                              <div 
                                className="flex items-center justify-center p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-amber-50 text-amber-700 border border-amber-300/80 shadow-2xs shrink-0"
                                title={`Observación: ${animal.observations}`}
                              >
                                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-700 stroke-[2.5]" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={animal.id}
                      onTouchStart={(e) => handleTouchStart(animal.id, e)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <Link 
                        to={`/inventario/perfil?id=${animal.id}&from=finca&farmId=${farmId}`}
                        onClick={(e) => handleCardClick(animal.id, e)}
                        className="block h-full cursor-pointer select-none"
                      >
                        {CardContent}
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              /* VISTA TIPO LISTA (SIN IMÁGENES) */
              <div className="space-y-2.5">
                {/* Cabecera de columnas para Desktop */}
                <div className="hidden lg:grid lg:grid-cols-[36px_160px_140px_85px_90px_105px_1fr_130px_24px] gap-3 px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 bg-white/70 backdrop-blur-xs rounded-xl border border-neutral-200/60 select-none items-center">
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      title={isAllFilteredSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                      className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all cursor-pointer ${
                        isAllFilteredSelected
                          ? 'bg-[#1B4820] border-[#1B4820] text-white'
                          : 'border-neutral-300 hover:border-[#1B4820]'
                      }`}
                    >
                      {isAllFilteredSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  </div>
                  <div>Arete / Nombre</div>
                  <div>Microchip</div>
                  <div>Sexo</div>
                  <div>Estado</div>
                  <div>Edad</div>
                  <div>Campo</div>
                  <div>Dueño</div>
                  <div></div>
                </div>

                {/* Filas de la Lista */}
                {paginatedAnimals.map((animal) => {
                  const isSelected = selectedAnimalIds.has(animal.id);
                  const isSelectionMode = selectedAnimalIds.size > 0;

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={animal.id}
                      onTouchStart={(e) => handleTouchStart(animal.id, e)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <Link
                        to={`/inventario/perfil?id=${animal.id}&from=finca&farmId=${farmId}`}
                        onClick={(e) => handleCardClick(animal.id, e)}
                        className={`group block bg-white rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer p-3.5 sm:p-4 select-none ${
                          isSelected 
                            ? 'border-[#1B4820] ring-2 ring-[#1B4820]/40 bg-emerald-50/20' 
                            : 'border-neutral-200/90 hover:border-[#1B4820]/40 hover:bg-neutral-50/60'
                        }`}
                      >
                        {/* 1. Vista Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-[36px_160px_140px_85px_90px_105px_1fr_130px_24px] gap-3 items-center w-full">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={(e) => handleCheckboxClick(animal.id, e)}
                              title={isSelected ? "Deseleccionar" : "Seleccionar"}
                              aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
                              className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#1B4820] border-[#1B4820] text-white opacity-100'
                                  : isSelectionMode
                                    ? 'border-neutral-300 hover:border-[#1B4820] opacity-100'
                                    : 'border-neutral-300 hover:border-[#1B4820] opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          </div>

                          {/* Arete / Nombre */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base font-black text-[#1B4820] truncate">
                                {animal.number ? `#${animal.number}` : (animal.name || (animal.chip_number ? `Chip ${animal.chip_number}` : 'Sin arete'))}
                              </span>
                              {(() => {
                                const rawNum = String(animal.number || '').trim().toLowerCase();
                                const hasDupNum = rawNum && duplicateAnalysis.duplicateNumbers.has(rawNum);
                                if (hasDupNum) {
                                  return (
                                    <span title="Número de arete repetido" className="shrink-0 inline-flex items-center">
                                      <Copy className="w-4 h-4 text-orange-500 stroke-[2.5]" />
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {Boolean(animal.observations && animal.observations.trim()) && (
                                <span 
                                  title={`Observación: ${animal.observations}`} 
                                  className="inline-flex items-center justify-center p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-300/80 shadow-2xs shrink-0"
                                >
                                  <FileText className="w-3 h-3 text-amber-700 stroke-[2.5]" />
                                </span>
                              )}
                            </div>
                            {animal.name && animal.number && (
                              <span className="text-[11px] font-bold text-neutral-500 truncate block">
                                {animal.name}
                              </span>
                            )}
                          </div>

                          {/* Microchip */}
                          <div className="flex items-center gap-1.5 text-neutral-700 min-w-0">
                            <Cpu className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-bold truncate text-xs sm:text-sm text-neutral-900">
                              {animal.chip_number || <span className="text-neutral-400 font-normal">Sin chip</span>}
                            </span>
                          </div>

                          {/* Sexo */}
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              animal.sex === 'Hembra' ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {animal.sex === 'Hembra' ? <FaVenus className="w-2.5 h-2.5" /> : <FaMars className="w-2.5 h-2.5" />}
                              <span>{animal.sex || 'Bovino'}</span>
                            </span>
                          </div>

                          {/* Estado */}
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              animal.status === 'Inactivo' ? 'bg-neutral-200 text-neutral-700 border border-neutral-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {animal.status === 'Inactivo' ? <XCircle className="w-2.5 h-2.5 text-red-500" /> : <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />}
                              <span>{animal.status || 'Activo'}</span>
                            </span>
                          </div>

                          {/* Edad */}
                          <div className="flex items-center gap-1.5 text-xs text-neutral-600 min-w-0">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate text-[11px] font-medium">{calculateAge(animal.birth_date)}</span>
                          </div>

                          {/* Campo (Potrero en la Finca) */}
                          <div className="flex items-center gap-1.5 text-xs text-neutral-600 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate text-[11px] font-medium">
                              {animal.potrero_id && potreroMap[animal.potrero_id] 
                                ? potreroMap[animal.potrero_id] 
                                : (currentFarm ? currentFarm.name : 'En la finca')}
                            </span>
                          </div>

                          {/* Dueño */}
                          <div className="flex items-center gap-1.5 text-xs text-neutral-600 min-w-0">
                            <UserCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate text-[11px] font-medium">
                              {animal.owner_id && ownerMap[animal.owner_id] ? ownerMap[animal.owner_id] : 'Sin dueño'}
                            </span>
                          </div>

                          {/* Flecha Chevron */}
                          <div className="flex justify-end">
                            <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-[#1B4820] group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>

                        {/* 2. Vista Móvil y Tablet */}
                        <div className="lg:hidden flex flex-col gap-2.5 w-full">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {(isSelectionMode || isSelected) && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCheckboxClick(animal.id, e)}
                                  className={`w-6 h-6 rounded-lg border-[1.5px] flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#1B4820] border-[#1B4820] text-white shadow-2xs'
                                      : 'border-neutral-300 bg-neutral-100'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </button>
                              )}
                              <span className="text-lg sm:text-xl font-black text-[#1B4820] truncate">
                                {animal.number ? `#${animal.number}` : (animal.name || (animal.chip_number ? `Chip ${animal.chip_number}` : 'Sin arete'))}
                              </span>
                              {(() => {
                                const rawNum = String(animal.number || '').trim().toLowerCase();
                                const hasDupNum = rawNum && duplicateAnalysis.duplicateNumbers.has(rawNum);
                                const rawName = String(animal.name || '').trim().toLowerCase();
                                const hasDupName = rawName && duplicateAnalysis.duplicateNames.has(rawName);
                                if (hasDupNum || hasDupName) {
                                  return (
                                    <span title={hasDupNum ? "Número de arete repetido" : "Nombre repetido"} className="shrink-0 inline-flex items-center">
                                      <Copy className="w-4 h-4 text-orange-500 stroke-[2.5]" />
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {Boolean(animal.observations && animal.observations.trim()) && (
                                <span 
                                  title={`Observación: ${animal.observations}`} 
                                  className="inline-flex items-center justify-center p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-300/80 shadow-2xs shrink-0"
                                >
                                  <FileText className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                                </span>
                              )}
                              {animal.name && animal.number && (
                                <span className="text-xs sm:text-sm font-bold text-neutral-600 truncate">
                                  "{animal.name}"
                                </span>
                              )}
                            </div>

                            {/* Badges en Móvil */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                title={animal.sex || 'Bovino'}
                                className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-2xs ${
                                  animal.sex === 'Hembra'
                                    ? 'bg-pink-100 text-pink-700 border-pink-200'
                                    : 'bg-blue-100 text-blue-700 border-blue-200'
                                }`}
                              >
                                {animal.sex === 'Hembra' ? <FaVenus className="w-3 h-3" /> : <FaMars className="w-3 h-3" />}
                              </span>

                              <span
                                title={animal.status || 'Activo'}
                                className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-2xs ${
                                  animal.status === 'Inactivo'
                                    ? 'bg-neutral-200 text-neutral-700 border-neutral-300'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {animal.status === 'Inactivo' ? (
                                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                              </span>

                              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-[#1B4820] group-hover:translate-x-0.5 transition-all ml-0.5" />
                            </div>
                          </div>

                          {/* Fila B: Chip, Edad, Potrero y Dueño */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Cpu className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="font-bold text-neutral-900 truncate text-xs sm:text-sm">
                                {animal.chip_number || <span className="text-neutral-400 font-normal">Sin chip</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate text-[11px] sm:text-xs">
                                {calculateAge(animal.birth_date)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 min-w-0">
                              <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate text-[11px] sm:text-xs">
                                {animal.potrero_id && potreroMap[animal.potrero_id] 
                                  ? potreroMap[animal.potrero_id] 
                                  : 'Sin potrero'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 min-w-0">
                              <UserCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate text-[11px] sm:text-xs">
                                {animal.owner_id && ownerMap[animal.owner_id] ? ownerMap[animal.owner_id] : 'Sin dueño'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* --- CONTROLES DE PAGINACIÓN --- */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-10 mb-8 bg-white px-6 py-4 rounded-3xl border border-neutral-200 shadow-sm gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-full sm:w-auto px-6 py-3 bg-neutral-100 text-neutral-700 font-black text-xs uppercase tracking-widest rounded-2xl disabled:opacity-40 transition-colors hover:bg-neutral-200 cursor-pointer disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs font-black text-neutral-500 uppercase tracking-widest">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-full sm:w-auto px-6 py-3 bg-[#1B4820] text-white font-black text-xs uppercase tracking-widest rounded-2xl disabled:opacity-40 transition-colors hover:bg-emerald-950 cursor-pointer disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        ) : (
          /* ESTADO VACÍO */
          <div className="text-center py-20 bg-white rounded-3xl border border-neutral-200/80 p-8 shadow-sm max-w-md mx-auto">
            <SearchX className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-black text-neutral-800 uppercase tracking-wider mb-1">Sin animales en esta finca</h3>
            <p className="text-xs text-neutral-500 mb-5 font-medium">
              {searchTerm || activeFiltersCount > 0 
                ? 'No se encontraron animales con los filtros o términos de búsqueda seleccionados en esta finca.'
                : `Aún no hay animales registrados en ${currentFarm?.name || 'esta finca'}.`}
            </p>
            {searchTerm || activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Restablecer filtros
              </button>
            ) : (
              <Link
                to={`/inventario/nuevo?farm_id=${farmId}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1B4820] hover:bg-emerald-950 text-white rounded-xl text-xs font-bold transition-colors shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Registrar primer animal</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* BARRA FLOTANTE DE ACCIONES PARA SELECCIÓN MÚLTIPLE */}
      <AnimatePresence>
        {selectedAnimalIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 sm:bottom-6 inset-x-0 mx-auto z-40 px-3 sm:px-4 w-full max-w-lg pointer-events-none"
          >
            <div className="pointer-events-auto bg-[#1B4820] text-white rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-4 flex items-center justify-between gap-3 border border-emerald-800/80 backdrop-blur-md">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0 font-black text-xs sm:text-base border border-white/20">
                  {selectedAnimalIds.size}
                </div>
                <p className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                  {selectedAnimalIds.size} {selectedAnimalIds.size === 1 ? 'seleccionado' : 'seleccionados'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelSelection}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black bg-emerald-400 hover:bg-emerald-300 text-neutral-950 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTÓN FLOTANTE DIRECTO A NUEVO REGISTRO EN ESTA FINCA */}
      <Link
        to={`/inventario/nuevo?farm_id=${farmId}`}
        className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 bg-[#1B4820] p-4 rounded-full text-white shadow-2xl transform transition-transform duration-300 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer ${
          selectedAnimalIds.size > 0 ? 'hidden sm:flex' : ''
        }`}
        title={`Registrar nuevo animal en ${currentFarm?.name || 'esta finca'}`}
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </Link>

      {/* MODAL DE CONFIRMACIÓN PARA CIERRE DE SESIÓN */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="Cambios sin sincronizar"
        description={`No se han podido subir todos los datos a la nube (tienes ${pendingLogoutCount} cambio(s) pendiente(s)).`}
        confirmText="Cerrar sesión"
        cancelText="Volver"
        onConfirm={async () => {
          setIsLogoutConfirmOpen(false);
          await executeLogout();
        }}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        isDanger={true}
      />

      {/* MODAL GESTIÓN DE FINCAS */}
      <FarmModal
        isOpen={isFarmModalOpen}
        onClose={() => setIsFarmModalOpen(false)}
        onFarmCreated={(f) => {
          showToast('¡Finca creada con éxito!', `La finca "${f.name}" fue registrada correctamente.`);
        }}
        onFarmUpdated={(f) => {
          showToast('¡Finca actualizada con éxito!', `Los cambios en "${f.name}" fueron guardados.`);
        }}
      />

      {/* MODAL GESTIÓN DE POTREROS */}
      <PotreroModal
        isOpen={isPotreroModalOpen}
        onClose={() => setIsPotreroModalOpen(false)}
        defaultFarmId={farmId}
        onPotreroCreated={(pot) => {
          showToast('¡Potrero creado con éxito!', `El potrero "${pot.name}" fue registrado correctamente.`);
        }}
        onPotreroUpdated={(pot) => {
          showToast('¡Potrero actualizado con éxito!', `Los cambios en "${pot.name}" fueron guardados.`);
        }}
      />

      {/* MODAL GESTIÓN DE DUEÑOS */}
      <OwnerModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        onOwnerCreated={(owner) => {
          showToast('¡Dueño creado con éxito!', `"${owner.name}" fue registrado correctamente.`);
        }}
        onOwnerUpdated={(owner) => {
          showToast('¡Dueño actualizado con éxito!', `Los cambios en "${owner.name}" fueron guardados.`);
        }}
      />

      {/* MODAL ESCÁNER DE CÓDIGO DE BARRAS PARA BÚSQUEDA */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScanSuccess={(scannedCode) => {
          setSearchTerm(scannedCode);
          showToast('Código escaneado', `Buscando animal con código: ${scannedCode}`);
        }}
      />

      {/* MODAL DE EDICIÓN MASIVA EN LOTE */}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedAnimalIds={selectedAnimalIds}
        farms={farms}
        potreros={farmPotreros}
        owners={owners}
        onSuccess={(count) => {
          setSelectedAnimalIds(new Set());
          showToast(
            '¡Edición masiva completada!',
            `Se actualizaron exitosamente ${count} ${count === 1 ? 'animal' : 'animales'} en lote.`
          );
        }}
      />

      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
