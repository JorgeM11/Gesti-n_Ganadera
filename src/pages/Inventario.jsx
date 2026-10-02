import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  SlidersHorizontal, 
  Scale, 
  Plus, 
  X, 
  Syringe, 
  ClipboardPlus, 
  CheckCircle2, 
  XCircle, 
  Check, 
  AlertCircle, 
  Building2, 
  Milk, 
  Dna, 
  Calendar, 
  Menu, 
  SearchX, 
  RefreshCcw 
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, clearLocalData } from '@/lib/db';
import { calculateAge, formatWeight, parseLocalDate } from '@/lib/dateUtils';
import { formatGeneticsLabel } from '@/lib/geneticsUtils';
import { logoutUser } from '@/lib/authService';
import SyncStatus from '@/components/ui/SyncStatus';
import AnimalImage from '@/components/inventario/AnimalImage';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FarmModal from '@/components/inventario/FarmModal';
import MilkingModal from '@/components/inventario/MilkingModal';
import NavigationDrawer from '@/components/inventario/NavigationDrawer';
import AnimalCardSkeleton from '@/components/inventario/AnimalCardSkeleton';
import Toast from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useForceResync } from '@/hooks/useForceResync';
import { runFullSync } from '@/lib/syncUtils';

const actionOptions = [
  { label: 'Vacunación por Lotes', icon: Syringe, type: 'batch' },
  { label: 'Nuevo Registro', icon: ClipboardPlus, href: '/inventario/nuevo' },
];

const ITEMS_PER_PAGE = 48;

// --- COMPONENTE DE CHECKBOX ---
const FilterCheckbox = ({ label, count, checked, onChange }) => (
  <label className="flex items-center gap-3 py-2.5 cursor-pointer group select-none">
    <input
      type="checkbox"
      className="hidden"
      checked={checked}
      onChange={onChange}
    />
    <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all ${
      checked ? 'bg-[#1B4820] border-[#1B4820]' : 'border-neutral-300 bg-white group-hover:border-[#1B4820]/50'
    }`}>
      {checked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
    </div>
    <span className="text-sm font-bold text-neutral-700 flex-1 group-hover:text-black transition-colors">{label}</span>
    {count !== undefined && <span className="text-xs font-bold text-neutral-400">({count})</span>}
  </label>
);

const SearchInput = ({ isMobile = false, searchTerm, setSearchTerm, onOpenFilters, activeFiltersCount }) => (
  <div className={`relative flex items-center ${isMobile
    ? 'md:hidden bg-white mt-3 w-full border-neutral-300 shadow-xs'
    : 'hidden md:flex bg-white md:w-full md:max-w-md border-neutral-200 shadow-sm'
    } rounded-2xl py-2 px-4 border focus-within:border-[#1B4820] transition-all`}>

    <Search className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
    <input
      type="text"
      placeholder={isMobile ? "Buscar código o nombre..." : "Buscar animal por código o nombre..."}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="flex-1 bg-transparent border-none outline-none text-neutral-900 font-medium placeholder-neutral-400 text-sm w-full"
    />
    <div className="border-l pl-3 ml-2 border-neutral-200 shrink-0 relative">
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
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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

  // --- ESTADOS PARA BATCH MODE ---
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState(new Set());

  // --- ESTADO PARA RESALTAR 8 MESES ---
  const [viewedHighlights, setViewedHighlights] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viewed8Months') || '[]'); }
    catch { return []; }
  });

  // --- ESTADOS PARA CIERRE DE SESIÓN ---
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [pendingLogoutCount, setPendingLogoutCount] = useState(0);

  // --- ESTADOS PARA FINCAS Y ORDEÑO ---
  const [selectedFarmFilter, setSelectedFarmFilter] = useState('ALL');
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isQuickMilkingOpen, setIsQuickMilkingOpen] = useState(false);
  const [milkingAnimal, setMilkingAnimal] = useState(null);

  // --- ESTADO PARA NOTIFICACIONES DE CONFIRMACIÓN (TOAST) ---
  const [toast, setToast] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setToast({ id: Date.now(), title, message, type });
  };

  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const farmMap = useMemo(() => {
    const map = {};
    farms.forEach(f => { map[f.id] = f.name; });
    return map;
  }, [farms]);

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
      if (a.breed) set.add(a.breed);
      else set.add('Mestizo');
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
  };

  const activeFiltersCount = 
    filters.sex.length + 
    filters.status.length + 
    filters.category.length + 
    filters.breed.length + 
    (selectedFarmFilter !== 'ALL' ? 1 : 0);

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
      const term = searchTerm.toLowerCase();
      const animalName = (a.name || '').toLowerCase();
      const animalNum = (a.number || '').toLowerCase();
      const matchesSearch = !term || animalNum.includes(term) || animalName.includes(term) || a.id.toLowerCase().includes(term);
      
      const matchesSex = filters.sex.length === 0 || filters.sex.includes(a.sex);
      const currentStatus = a.status || 'Activo';
      const matchesStatus = filters.status.length === 0 || filters.status.includes(currentStatus);
      const matchesFarm = selectedFarmFilter === 'ALL' || a.farm_id === selectedFarmFilter;
      
      const currentBreed = a.breed || 'Mestizo';
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

      return matchesSearch && matchesSex && matchesStatus && matchesCategory && matchesFarm && matchesBreed;
    });

    // Ordenar: Los de 8 meses resaltados van de primeros
    const highlighted = [];
    const normal = [];
    
    filtered.forEach(a => {
      if (is8MonthsOld(a)) highlighted.push(a);
      else normal.push(a);
    });

    return [...highlighted, ...normal];
  }, [allAnimals, searchTerm, filters, selectedFarmFilter, viewedHighlights]);

  // --- REINICIAR PAGINACIÓN AL FILTRAR O BUSCAR ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, selectedFarmFilter]);

  // --- PAGINACIÓN ---
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
      if (type === 'breed') return (a.breed || 'Mestizo') === value;
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

  const toggleAnimalSelection = (id) => {
    const newSelection = new Set(selectedAnimalIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedAnimalIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedAnimalIds.size === filteredAnimals.length) {
      setSelectedAnimalIds(new Set());
    } else {
      setSelectedAnimalIds(new Set(filteredAnimals.map(a => a.id)));
    }
  };

  const handleContinueBatch = () => {
    if (selectedAnimalIds.size === 0) return;
    sessionStorage.setItem('batchAnimalIds', JSON.stringify(Array.from(selectedAnimalIds)));
    navigate('/inventario/tratamiento-lote');
  };

  const cancelBatchMode = () => {
    setIsBatchMode(false);
    setSelectedAnimalIds(new Set());
  };

  return (
    <main className="min-h-screen bg-[#F0F2EB] font-sans pb-32 relative">

      {/* OVERLAY FONDO OSCURO PARA FAB O FILTROS */}
      <AnimatePresence>
        {(isFabOpen || isFilterOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-black/60 cursor-pointer ${isFilterOpen ? 'z-[55]' : 'z-40'}`}
            onClick={() => { setIsFabOpen(false); setIsFilterOpen(false); }}
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR NAVIGATION DRAWER (HAMBURGUESA) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        farmsCount={farms.length}
        onOpenFarms={() => setIsFarmModalOpen(true)}
        onOpenMilking={() => setIsQuickMilkingOpen(true)}
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
              {/* 1. Filtro de Finca (Sin el botón de crear finca) */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider">Finca</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setSelectedFarmFilter('ALL')}
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
                        onClick={() => setSelectedFarmFilter(f.id)}
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
                </div>
              </div>

              {/* 2. Filtro por Raza */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 mb-2 uppercase tracking-wider">Raza</h4>
                <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
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
          />
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-5 md:mt-8 relative z-0">

        {activeFiltersCount > 0 && !isBatchMode && (
          <div className="mb-4 flex items-center justify-between bg-emerald-50 border border-emerald-200/80 text-emerald-950 px-4 py-2.5 rounded-2xl shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider">Filtros Activos ({activeFiltersCount})</span>
            <button 
              type="button"
              onClick={clearFilters} 
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-100/70 border border-emerald-300 text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-emerald-800 stroke-[2.5]" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}

        {/* Banner de Modo Batch */}
        {isBatchMode && (
          <div className="mb-6 flex items-center justify-between bg-[#1B4820] text-white px-6 py-4 rounded-[2rem] shadow-lg shadow-[#1B4820]/20 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Syringe className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-black uppercase tracking-widest">Vacunación por Lotes</span>
            </div>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-black uppercase tracking-widest bg-white/10 px-4 py-2 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
            >
              {selectedAnimalIds.size === filteredAnimals.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>
        )}

        {/* ESTADO DE CARGA: SKELETON */}
        {allAnimals === undefined ? (
          <AnimalCardSkeleton count={8} />
        ) : paginatedAnimals.length > 0 ? (
          <>
            {/* GRID DE CARDS ORDENADAS Y PROPORCIONADAS */}
            <motion.div
              layout
              className="grid grid-cols-1 min-[460px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
            >
              {paginatedAnimals.map((animal) => {
                const isSelected = selectedAnimalIds.has(animal.id);
                const isHighlight = is8MonthsOld(animal);
                const animalDisplayName = animal.name ? animal.name : `#${animal.number}`;

                const CardContent = (
                  <motion.article 
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`relative bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full cursor-pointer group border-2 ${
                      isSelected 
                        ? 'border-[#1B4820] ring-2 ring-[#1B4820]/20' 
                        : isHighlight 
                          ? 'border-amber-400 shadow-amber-400/20 shadow-lg' 
                          : 'border-neutral-200/80 hover:border-neutral-300'
                    }`}
                  >
                    {/* Alerta Visual de 8 Meses */}
                    {isHighlight && !isBatchMode && (
                      <div className="w-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-widest text-center py-1.5 z-20 flex items-center justify-center gap-1.5 shadow-xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>8 Meses Cumplidos</span>
                      </div>
                    )}

                    {/* SECCIÓN DE IMAGEN */}
                    <div className="relative aspect-[4/3] w-full bg-neutral-100 overflow-hidden">
                      <AnimalImage
                        photoPath={animal.photo_path}
                        photoBlob={animal.photo_blob}
                        alt={animalDisplayName}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                          isSelected ? 'opacity-70 grayscale-[0.2]' : ''
                        }`}
                      />

                      {/* Checkbox de selección en modo lote */}
                      {isBatchMode && (
                        <div className={`absolute top-3 left-3 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all z-10 ${
                          isSelected ? 'bg-[#1B4820] border-[#1B4820] shadow-md' : 'bg-white/90 border-neutral-300 shadow-sm'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                        </div>
                      )}

                      {/* Badge de Sexo (si no está en modo lote) */}
                      {!isBatchMode && (
                        <div className="absolute top-3 left-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${
                            animal.sex === 'Hembra' ? 'bg-pink-600/90 backdrop-blur-xs' : 'bg-blue-700/90 backdrop-blur-xs'
                          }`}>
                            {animal.sex || 'Bovino'}
                          </span>
                        </div>
                      )}

                      {/* Badge de Status (Activo / Inactivo) */}
                      <div className="absolute top-3 right-3">
                        <div className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm backdrop-blur-xs ${
                          animal.status === 'Inactivo' 
                            ? 'bg-neutral-800/85 text-white' 
                            : 'bg-emerald-600/90 text-white'
                        }`}>
                          {animal.status === 'Inactivo' ? (
                            <XCircle className="w-3 h-3 text-red-300" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {animal.status || 'Activo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECCIÓN DE INFORMACIÓN ORDENADA (SIN SOLAPAMIENTOS) */}
                    <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 gap-3">
                      <div>
                        {/* Nombre / Código del Animal */}
                        <div className="mb-2">
                          <h2 
                            className="text-lg font-black text-neutral-900 leading-tight truncate group-hover:text-[#1B4820] transition-colors" 
                            title={animalDisplayName}
                          >
                            {animalDisplayName}
                          </h2>
                          {animal.name && (
                            <p className="text-xs font-bold text-neutral-400 mt-0.5">#{animal.number}</p>
                          )}
                        </div>

                        {/* Fila 1: Raza & Genética */}
                        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 py-0.5">
                          <Dna className="w-3.5 h-3.5 text-[#1B4820] shrink-0" />
                          <span className="truncate">
                            {formatGeneticsLabel(animal.breed, animal.purity_percentage, animal.breed_composition)}
                          </span>
                        </div>

                        {/* Fila 2: Finca asignada */}
                        <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 py-0.5">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">
                            {animal.farm_id && farmMap[animal.farm_id] ? farmMap[animal.farm_id] : 'Sin finca asignada'}
                          </span>
                        </div>

                        {/* Fila 3: Edad */}
                        <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 py-0.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">
                            {calculateAge(animal.birth_date)}
                          </span>
                        </div>
                      </div>

                      {/* Fila Inferior: Peso y Acción Rápida de Ordeño */}
                      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                        <div className="flex items-center text-neutral-800 bg-neutral-100/90 border border-neutral-200/70 px-2.5 py-1.5 rounded-xl">
                          <Scale className="w-3.5 h-3.5 mr-1.5 text-[#1B4820]" strokeWidth={2.5} />
                          <span className="text-xs font-black tracking-tight">{formatWeight(animal.last_weight_kg)}</span>
                        </div>

                        {animal.sex === 'Hembra' && !isBatchMode && (
                          <button
                            type="button"
                            title="Registrar Ordeño"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMilkingAnimal(animal);
                            }}
                            className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200/70 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                          >
                            <Milk className="w-3.5 h-3.5" />
                            <span>Ordeño</span>
                          </button>
                        )}
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
                      if (isBatchMode) {
                        toggleAnimalSelection(animal.id);
                      } else if (isHighlight) {
                        const updated = [...viewedHighlights, animal.id];
                        setViewedHighlights(updated);
                        localStorage.setItem('viewed8Months', JSON.stringify(updated));
                      }
                    }}
                  >
                    {isBatchMode ? (
                      <div className="block h-full">
                        {CardContent}
                      </div>
                    ) : (
                      <Link to={`/inventario/perfil?id=${animal.id}`} className="block h-full cursor-pointer">
                        {CardContent}
                      </Link>
                    )}
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

      {/* BARRA INFERIOR DE MODO POR LOTES */}
      <AnimatePresence>
        {isBatchMode && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 w-full bg-white border-t border-neutral-200 z-[60] px-5 sm:px-6 py-4 sm:py-5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-[2.5rem]"
          >
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-col text-left items-start pl-4 sm:pl-0">
                <span className="text-2xl font-black text-black leading-none">{selectedAnimalIds.size}</span>
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mt-1">Animales Seleccionados</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={cancelBatchMode}
                  className="flex-1 sm:flex-initial px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-neutral-100 text-neutral-600 font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleContinueBatch}
                  disabled={selectedAnimalIds.size === 0}
                  className="flex-1 sm:flex-initial px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl bg-[#1B4820] text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-950 transition-all shadow-lg shadow-[#1B4820]/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group flex items-center justify-center gap-2 cursor-pointer"
                >
                  Continuar
                  <Syringe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTÓN FLOTANTE (FAB) STREAMLINED (NUEVO REGISTRO Y MODO BATCH) */}
      {!isBatchMode && (
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-3">
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="flex flex-col items-end gap-3 mb-2"
              >
                {actionOptions.map((option, index) => {
                  const Icon = option.icon;
                  const content = (
                    <div
                      key={index}
                      onClick={() => {
                        setIsFabOpen(false);
                        if (option.type === 'batch') {
                          setIsBatchMode(true);
                        }
                      }}
                      className="flex items-center gap-3 bg-white rounded-full py-3 px-5 shadow-xl border border-neutral-200/80 hover:bg-[#1B4820] group transition-all cursor-pointer"
                    >
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-800 group-hover:text-white transition-colors">
                        {option.label}
                      </span>
                      <div className="p-2 rounded-full bg-[#1B4820] text-white group-hover:bg-white group-hover:text-[#1B4820] transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                  );

                  return option.href ? (
                    <Link key={index} to={option.href} className="cursor-pointer">
                      {content}
                    </Link>
                  ) : content;
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`bg-[#1B4820] p-4 rounded-full text-white shadow-2xl transform transition-transform duration-300 cursor-pointer hover:scale-105 active:scale-95 ${isFabOpen ? 'rotate-180 bg-black' : ''}`}
            title="Acciones rápidas"
          >
            {isFabOpen ? <X className="w-7 h-7" strokeWidth={2.5} /> : <Plus className="w-7 h-7" strokeWidth={2.5} />}
          </button>
        </div>
      )}

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

      {/* MODAL REGISTRO DE ORDEÑO (RÁPIDO DESDE SIDEBAR O DIRECTO DESDE CARD) */}
      <MilkingModal
        isOpen={isQuickMilkingOpen || !!milkingAnimal}
        animal={milkingAnimal}
        onClose={() => {
          setMilkingAnimal(null);
          setIsQuickMilkingOpen(false);
        }}
        onRecordCreated={(record, cow) => {
          const cowLabel = cow?.number ? `#${cow.number}` : (milkingAnimal?.number ? `#${milkingAnimal.number}` : 'la vaca');
          showToast(
            '¡Ordeño registrado con éxito!',
            `Se registraron ${record.liters} Lts de leche para ${cowLabel} (${record.shift || 'Turno'}).`
          );
        }}
      />

      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}