import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  SlidersHorizontal, 
  Scale, 
  Plus, 
  X, 
  CheckCircle2, 
  XCircle, 
  Check, 
  AlertCircle, 
  Building2, 
  Dna, 
  Calendar, 
  Menu, 
  SearchX, 
  RefreshCcw,
  Cpu,
  UserCheck,
  Info,
  ScanBarcode
} from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, clearLocalData } from '@/lib/db';
import { calculateAge, formatWeight, parseLocalDate } from '@/lib/dateUtils';
import { formatGeneticsLabel } from '@/lib/geneticsUtils';
import { logoutUser } from '@/lib/authService';
import SyncStatus from '@/components/ui/SyncStatus';
import AnimalImage from '@/components/inventario/AnimalImage';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FarmModal from '@/components/inventario/FarmModal';
import PotreroModal from '@/components/inventario/PotreroModal';
import OwnerModal from '@/components/inventario/OwnerModal';
import BarcodeScannerModal from '@/components/inventario/BarcodeScannerModal';
import NavigationDrawer from '@/components/inventario/NavigationDrawer';
import AnimalCardSkeleton from '@/components/inventario/AnimalCardSkeleton';
import Toast from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useForceResync } from '@/hooks/useForceResync';
import { runFullSync } from '@/lib/syncUtils';

const ITEMS_PER_PAGE = 48;

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

const SearchInput = ({ isMobile = false, searchTerm, setSearchTerm, onOpenFilters, activeFiltersCount, onScanBarcode }) => (
  <div className={`relative flex items-center ${isMobile
    ? 'md:hidden bg-white mt-3 w-full border-neutral-300 shadow-xs'
    : 'hidden md:flex bg-white md:w-full md:max-w-md border-neutral-200 shadow-sm'
    } rounded-2xl py-2 px-4 border focus-within:border-[#1B4820] transition-all`}>

    <Search className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
    <input
      type="text"
      placeholder={isMobile ? "Buscar arete, chip, nombre..." : "Buscar por arete, chip o nombre"}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
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
      className="p-1.5 text-[#1B4820] hover:text-[#0F2912] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer mr-1 shrink-0"
      title="Escanear código de barras (chip o arete)"
    >
      <ScanBarcode className="w-4 h-4" />
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

export default function InventarioPage() {
  const navigate = useNavigate();
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

  // Variantes para móvil: Bottom Sheet que entra desde el fondo y se cierra arrastrando hacia abajo
  const mobileFilterVariants = {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' }
  };

  // Variantes para escritorio: Panel flotante superior derecho
  const desktopFilterVariants = {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 20, scale: 0.98 }
  };

  // Custom Hook para Respaldo Forzado
  const { isResyncing, resyncSuccess, handleForceSync } = useForceResync();

  // --- ESTADO DE PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);

  // Asegurar scroll al inicio al cambiar de página
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [currentPage]);

  // --- ESTADO PARA RESALTAR 8 MESES ---
  const [viewedHighlights, setViewedHighlights] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viewed8Months') || '[]'); }
    catch { return []; }
  });

  // --- ESTADOS PARA CIERRE DE SESIÓN ---
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [pendingLogoutCount, setPendingLogoutCount] = useState(0);

  // --- ESTADOS PARA FINCAS, POTREROS Y DUEÑOS ---
  const [selectedFarmFilter, setSelectedFarmFilter] = useState('ALL');
  const [selectedPotreroFilter, setSelectedPotreroFilter] = useState('ALL');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('ALL');
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPotreroModalOpen, setIsPotreroModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);

  // --- ESTADO PARA NOTIFICACIONES DE CONFIRMACIÓN (TOAST) ---
  const [toast, setToast] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setToast({ id: Date.now(), title, message, type });
  };

  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const potreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray()) || [];
  const owners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];

  const farmMap = useMemo(() => {
    const map = {};
    farms.forEach(f => { map[f.id] = f.name; });
    return map;
  }, [farms]);

  const potreroMap = useMemo(() => {
    const map = {};
    potreros.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [potreros]);

  const ownerMap = useMemo(() => {
    const map = {};
    owners.forEach(o => { map[o.id] = o.name; });
    return map;
  }, [owners]);

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

      // 1. Si hay internet y hay cambios pendientes, sincronizar automáticamente
      if (pendingCount > 0 && navigator.onLine) {
        console.log('Sincronizando cambios antes del cierre de sesión...');
        await runFullSync();
        pendingCount = await db.sync_queue.count();
      }

      // 2. Si todavía quedan cambios pendientes
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
    sex: [],
    status: [],
    category: [],
    breed: []
  });

  const allAnimals = useLiveQuery(
    () => db.animals
      .orderBy('updated_at')
      .reverse()
      .filter(a => !a.deleted_at)
      .toArray(),
    []
  );

  // Extraer todas las razas presentes en los animales
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
    setFilters({ sex: [], status: [], category: [], breed: [] });
    setSelectedFarmFilter('ALL');
    setSelectedPotreroFilter('ALL');
    setSelectedOwnerFilter('ALL');
  };

  const activeFiltersCount = 
    filters.sex.length + 
    filters.status.length + 
    filters.category.length + 
    filters.breed.length + 
    (selectedFarmFilter !== 'ALL' ? 1 : 0) +
    (selectedPotreroFilter !== 'ALL' ? 1 : 0) +
    (selectedOwnerFilter !== 'ALL' ? 1 : 0);

  // Lógica para detectar exactamente los 8 meses
  const is8MonthsOld = (animal) => {
    if (!animal.birth_date) return false;
    if (viewedHighlights.includes(animal.id)) return false;
    
    const birth = parseLocalDate(animal.birth_date);
    const months = (new Date() - birth) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.floor(months) === 8;
  };

  const filteredAnimals = useMemo(() => {
    if (!allAnimals) return [];

    const filtered = allAnimals.filter(a => {
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
      const currentStatus = a.status || 'Activo';
      const matchesStatus = filters.status.length === 0 || filters.status.includes(currentStatus);
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

      let category = 'Desconocida';
      if (a.birth_date) {
        const birth = parseLocalDate(a.birth_date);
        const months = (new Date() - birth) / (1000 * 60 * 60 * 24 * 30.44);
        if (months < 9) category = 'Becerro';
        else if (months < 19) category = 'Maute';
        else if (months < 25) category = 'Novillo';
        else category = 'Adulto';
      }
      const matchesCategory = filters.category.length === 0 || filters.category.includes(category);

      return matchesSearch && matchesSex && matchesStatus && matchesCategory && matchesFarm && matchesPotrero && matchesOwner && matchesBreed;
    });

    // Ordenar: Los de 8 meses resaltados van de primeros
    const highlighted = [];
    const normal = [];
    
    filtered.forEach(a => {
      if (is8MonthsOld(a)) highlighted.push(a);
      else normal.push(a);
    });

    return [...highlighted, ...normal];
  }, [allAnimals, searchTerm, filters, selectedFarmFilter, selectedPotreroFilter, selectedOwnerFilter, viewedHighlights, ownerMap]);

  // --- REINICIAR PAGINACION AL FILTRAR O BUSCAR ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, selectedFarmFilter, selectedPotreroFilter, selectedOwnerFilter]);

  // --- PAGINACION ---
  const totalPages = Math.ceil(filteredAnimals.length / ITEMS_PER_PAGE);
  const paginatedAnimals = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAnimals.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAnimals, currentPage]);

  const getCount = (type, value) => {
    if (!allAnimals) return 0;
    return allAnimals.filter(a => {
      if (type === 'sex') return a.sex === value;
      if (type === 'status') return (a.status || 'Activo') === value;
      if (type === 'breed') return ((a.breed || '').trim() || 'Sin raza') === value;
      if (type === 'category') {
        let cat = 'Desconocida';
        if (a.birth_date) {
          const birth = parseLocalDate(a.birth_date);
          const months = (new Date() - birth) / (1000 * 60 * 60 * 24 * 30.44);
          if (months < 9) cat = 'Becerro';
          else if (months < 19) cat = 'Maute';
          else if (months < 25) cat = 'Novillo';
          else cat = 'Adulto';
        }
        return cat === value;
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

      {/* --- PANEL DE FILTROS ADAPTATIVO --- */}
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
              <h3 className="text-xl font-black text-neutral-900">Filtros de Búsqueda</h3>
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
              {/* 1. Filtro de Finca */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Finca</h4>
                  {selectedFarmFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFarmFilter('ALL');
                        setSelectedPotreroFilter('ALL');
                      }}
                      className="text-[11px] font-bold text-[#1B4820] hover:underline cursor-pointer"
                    >
                      Todas
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFarmFilter('ALL');
                      setSelectedPotreroFilter('ALL');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedFarmFilter === 'ALL'
                        ? 'bg-[#1B4820] text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    Todas las Fincas ({allAnimals?.length || 0})
                  </button>
                  {farms.map(f => {
                    const count = allAnimals?.filter(a => a.farm_id === f.id).length || 0;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => {
                          setSelectedFarmFilter(f.id);
                          setSelectedPotreroFilter('ALL');
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          selectedFarmFilter === f.id
                            ? 'bg-[#1B4820] text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                        <span className="opacity-75 ml-2 text-[10px]">({count})</span>
                      </button>
                    );
                  })}
                  {(() => {
                    const sinFincaCount = allAnimals?.filter(a => !a.farm_id).length || 0;
                    if (sinFincaCount === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFarmFilter('NONE');
                          setSelectedPotreroFilter('ALL');
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          selectedFarmFilter === 'NONE'
                            ? 'bg-[#1B4820] text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        <span className="truncate italic text-neutral-500">Sin finca asignada</span>
                        <span className="opacity-75 ml-2 text-[10px]">({sinFincaCount})</span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* 2. Filtro de Potrero (después de escoger finca) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-black text-neutral-900 uppercase tracking-wider">
                    Potrero {selectedFarmFilter !== 'ALL' && farmMap[selectedFarmFilter] ? `(${farmMap[selectedFarmFilter]})` : ''}
                  </h4>
                  {selectedFarmFilter !== 'ALL' && selectedPotreroFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedPotreroFilter('ALL')}
                      className="text-[11px] font-bold text-[#1B4820] hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                  )}
                </div>

                {selectedFarmFilter === 'ALL' ? (
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs text-neutral-500 font-medium flex items-center gap-2">
                    <Info className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span>Selecciona una finca arriba para habilitar el filtro por potrero.</span>
                  </div>
                ) : (
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
                      Todos los potreros de {farmMap[selectedFarmFilter]}
                    </button>
                    {potreros.filter(p => p.farm_id === selectedFarmFilter).length === 0 ? (
                      <p className="text-xs text-neutral-400 italic p-2">Esta finca no tiene potreros registrados.</p>
                    ) : (
                      potreros.filter(p => p.farm_id === selectedFarmFilter).map(p => {
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
                )}
              </div>

              {/* 3. Filtro por Dueño */}
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
                    Todos los Dueños ({allAnimals?.length || 0})
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

              {/* 2. Filtro por Raza */}
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

              {/* 3. Estatus */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider">Estatus del Animal</h4>
                <div className="space-y-0.5">
                  <FilterCheckbox label="Activos en finca" count={getCount('status', 'Activo')} checked={filters.status.includes('Activo')} onChange={() => toggleFilter('status', 'Activo')} />
                  <FilterCheckbox label="Inactivos (Vendidos/Fallecidos)" count={getCount('status', 'Inactivo')} checked={filters.status.includes('Inactivo')} onChange={() => toggleFilter('status', 'Inactivo')} />
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

              {/* 5. Categoría */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider">Categoría por Edad</h4>
                <div className="space-y-0.5">
                  <FilterCheckbox label="Becerros/as (0 a 8 meses)" count={getCount('category', 'Becerro')} checked={filters.category.includes('Becerro')} onChange={() => toggleFilter('category', 'Becerro')} />
                  <FilterCheckbox label="Mautes/as (9 a 18 meses)" count={getCount('category', 'Maute')} checked={filters.category.includes('Maute')} onChange={() => toggleFilter('category', 'Maute')} />
                  <FilterCheckbox label="Novillos/as (19 a 24 meses)" count={getCount('category', 'Novillo')} checked={filters.category.includes('Novillo')} onChange={() => toggleFilter('category', 'Novillo')} />
                  <FilterCheckbox label="Adultos Toro/Vaca (+24 meses)" count={getCount('category', 'Adulto')} checked={filters.category.includes('Adulto')} onChange={() => toggleFilter('category', 'Adulto')} />
                  <FilterCheckbox label="Edad Desconocida" count={getCount('category', 'Desconocida')} checked={filters.category.includes('Desconocida')} onChange={() => toggleFilter('category', 'Desconocida')} />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-neutral-100 bg-white lg:rounded-b-[2rem]">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="w-full bg-[#1B4820] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-950 transition-colors shadow-lg shadow-[#1B4820]/20 cursor-pointer"
              >
                Ver {filteredAnimals.length} Resultados
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER PRINCIPAL DE INVENTARIO */}
      <header className="bg-white md:bg-[#1B4820] w-full px-4 pt-4 pb-4 md:py-4 md:px-8 sticky top-0 z-30 shadow-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex md:flex-1 items-center justify-between md:justify-start w-full gap-3">
            {/* Botón de Menú Hamburguesa */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="p-2.5 rounded-2xl text-[#1B4820] md:text-white hover:bg-[#1B4820]/10 md:hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                title="Abrir menú de navegación"
              >
                <Menu className="w-6 h-6 text-[#1B4820] md:text-white" />
              </button>
              <h1 className="text-xl md:text-3xl font-black text-[#1B4820] md:text-white tracking-tight whitespace-nowrap">
                Inventario
              </h1>
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
              {selectedFarmFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>Finca: {selectedFarmFilter === 'NONE' ? 'Sin finca' : (farmMap[selectedFarmFilter] || 'Seleccionada')}</span>
                  <button type="button" onClick={() => { setSelectedFarmFilter('ALL'); setSelectedPotreroFilter('ALL'); }} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              )}
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
              {filters.status.map(st => (
                <span key={st} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>{st}</span>
                  <button type="button" onClick={() => toggleFilter('status', st)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}
              {filters.breed.map(b => (
                <span key={b} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>Raza: {b}</span>
                  <button type="button" onClick={() => toggleFilter('breed', b)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}
              {filters.category.map(c => (
                <span key={c} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-300 shadow-2xs">
                  <span>{c}</span>
                  <button type="button" onClick={() => toggleFilter('category', c)} className="text-neutral-400 hover:text-black ml-0.5 font-black cursor-pointer">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ESTADO DE CARGA: SKELETON */}
        {allAnimals === undefined ? (
          <AnimalCardSkeleton count={8} />
        ) : paginatedAnimals.length > 0 ? (
          <>
            {/* GRID DE CARDS ORDENADAS Y PROPORCIONADAS (2 COLUMNAS EN MÓVIL) */}
            <motion.div
              layout
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6"
            >
              {paginatedAnimals.map((animal) => {
                const isHighlight = is8MonthsOld(animal);

                const CardContent = (
                  <motion.article 
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`relative bg-white rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full cursor-pointer group border-2 ${
                      isHighlight 
                        ? 'border-amber-400 shadow-amber-400/20 shadow-lg' 
                        : 'border-neutral-200/80 hover:border-neutral-300'
                    }`}
                  >
                    {/* Alerta Visual de 8 Meses */}
                    {isHighlight && (
                      <div className="w-full bg-amber-400 text-amber-950 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center py-1 sm:py-1.5 z-20 flex items-center justify-center gap-1 sm:gap-1.5 shadow-xs">
                        <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>8 Meses Cumplidos</span>
                      </div>
                    )}

                    {/* SECCIÓN DE IMAGEN */}
                    <div className="relative aspect-[4/3] w-full bg-neutral-100 overflow-hidden">
                      <AnimalImage
                        photoPath={animal.photo_path}
                        photoBlob={animal.photo_blob}
                        alt={`Arete #${animal.number}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Barra Superior de Badges Alineados (Género y Activo/Inactivo) */}
                      <div className="absolute top-2 inset-x-2 sm:top-2.5 sm:inset-x-2.5 flex items-center justify-between z-10 pointer-events-none gap-1.5">
                        {/* Pill de Género */}
                        <span className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-sm backdrop-blur-xs leading-none ${
                          animal.sex === 'Hembra' ? 'bg-pink-600/90' : 'bg-blue-700/90'
                        }`}>
                          {animal.sex === 'Hembra' ? (
                            <FaVenus className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                          ) : (
                            <FaMars className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                          )}
                          <span>{animal.sex || 'Bovino'}</span>
                        </span>

                        {/* Pill de Status (Activo / Inactivo) */}
                        <span className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-sm backdrop-blur-xs leading-none ${
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
                        <div className="mb-1 sm:mb-1.5">
                          <h2 
                            className="text-base sm:text-lg font-black text-[#1B4820] leading-tight truncate"
                          >
                            #{animal.number}
                          </h2>
                        </div>

                        {/* Chip (solo el dato) */}
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-neutral-600 py-0.5 truncate">
                          <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate font-bold text-neutral-900">{animal.chip_number || 'Sin chip'}</span>
                        </div>

                        {/* Raza (solo el dato) */}
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

                      {/* Fila Inferior: Peso (como estaba antes) */}
                      <div className="pt-2 sm:pt-3 border-t border-neutral-100 flex items-center justify-between gap-1 sm:gap-2">
                        <div className="flex items-center text-neutral-800 bg-neutral-100/90 border border-neutral-200/70 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl">
                          <Scale className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 text-[#1B4820]" strokeWidth={2.5} />
                          <span className="text-[11px] sm:text-xs font-black tracking-tight">{formatWeight(animal.last_weight_kg)}</span>
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
                    onClick={() => {
                      if (isHighlight) {
                        const updated = [...viewedHighlights, animal.id];
                        setViewedHighlights(updated);
                        localStorage.setItem('viewed8Months', JSON.stringify(updated));
                      }
                    }}
                  >
                    <Link to={`/inventario/perfil?id=${animal.id}`} className="block h-full cursor-pointer">
                      {CardContent}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>

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
          /* ESTADO VACÍO ELEGANTE (SIN EMOJIS) */
          <div className="text-center py-20 bg-white rounded-3xl border border-neutral-200/80 p-8 shadow-sm max-w-md mx-auto">
            <SearchX className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-black text-neutral-800 uppercase tracking-wider mb-1">Sin resultados</h3>
            <p className="text-xs text-neutral-500 mb-5 font-medium">No se encontraron animales con los filtros o términos de búsqueda seleccionados.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE DIRECTO A NUEVO REGISTRO */}
      <Link
        to="/inventario/nuevo"
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 bg-[#1B4820] p-4 rounded-full text-white shadow-2xl transform transition-transform duration-300 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
        title="Registrar nuevo animal"
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
        onFarmCreated={(farm) => {
          showToast('¡Finca creada con éxito!', `La finca "${farm.name}" fue registrada correctamente.`);
        }}
        onFarmUpdated={(farm) => {
          showToast('¡Finca actualizada con éxito!', `Los cambios en "${farm.name}" fueron guardados.`);
        }}
      />

      {/* MODAL GESTIÓN DE POTREROS */}
      <PotreroModal
        isOpen={isPotreroModalOpen}
        onClose={() => setIsPotreroModalOpen(false)}
        defaultFarmId={selectedFarmFilter !== 'ALL' ? selectedFarmFilter : ''}
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

      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}