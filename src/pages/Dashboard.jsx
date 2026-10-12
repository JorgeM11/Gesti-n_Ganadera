import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Building2,
  Fence,
  UserCheck,
  FileText,
  Cpu,
  ChevronRight,
  ArrowRight,
  Filter,
  RotateCcw,
  Menu,
  Dna,
  CheckCircle2,
  History
} from 'lucide-react';
import { FaMars, FaVenus } from 'react-icons/fa6';
import { GiCow } from 'react-icons/gi';

import { db, clearLocalData } from '@/lib/db';
import { parseLocalDate } from '@/lib/dateUtils';
import { logoutUser, getCurrentUser } from '@/lib/authService';
import { useForceResync } from '@/hooks/useForceResync';

function formatDateTime(isoString) {
  if (!isoString) return '---';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '---';
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '---';
  }
}

import SyncStatus from '@/components/ui/SyncStatus';
import NavigationDrawer from '@/components/inventario/NavigationDrawer';
import FarmModal from '@/components/inventario/FarmModal';
import PotreroModal from '@/components/inventario/PotreroModal';
import OwnerModal from '@/components/inventario/OwnerModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Toast from '@/components/ui/Toast';
import CustomSelect from '@/components/ui/CustomSelect';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';

// Categorías ganaderas por edad
const AGE_CATEGORIES = [
  { id: 'Becerro', label: 'Becerros (0 a 12 meses)', color: 'from-amber-500 to-amber-600', badge: 'bg-amber-100 text-amber-800' },
  { id: 'Maute Macho', label: 'Mautes Macho (+12 a 36 m)', color: 'from-blue-500 to-blue-600', badge: 'bg-blue-100 text-blue-800' },
  { id: 'Maute Hembra', label: 'Mautes Hembra (+12 a 24 m)', color: 'from-pink-500 to-pink-600', badge: 'bg-pink-100 text-pink-800' },
  { id: 'Novilla', label: 'Novillas (+24 a 36 m)', color: 'from-purple-500 to-purple-600', badge: 'bg-purple-100 text-purple-800' },
  { id: 'Adulto', label: 'Adultos Toro/Vaca (+36 m)', color: 'from-emerald-600 to-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  { id: 'Desconocida', label: 'Edad Desconocida', color: 'from-neutral-400 to-neutral-500', badge: 'bg-neutral-100 text-neutral-700' },
];

function getAnimalAgeCategory(animal) {
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

export default function DashboardPage() {
  const navigate = useNavigate();

  // Estados de navegación y modales
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPotreroModalOpen, setIsPotreroModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Estados de cierre de sesión
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [pendingLogoutCount, setPendingLogoutCount] = useState(0);

  // Hook de sincronización forzada
  const { isResyncing, resyncSuccess, handleForceSync } = useForceResync();

  // Estados de filtros del Dashboard
  const [selectedFarmId, setSelectedFarmId] = useState('ALL');
  const [selectedPotreroId, setSelectedPotreroId] = useState('ALL');
  const [selectedOwnerId, setSelectedOwnerId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'Activo' | 'Inactivo'

  const showToast = (title, message, type = 'success') => {
    setToast({ id: Date.now(), title, message, type });
  };

  // Consultas reactivas Dexie (100% offline-first)
  const rawFarms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray());
  const rawPotreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray());
  const rawOwners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray());
  const rawAnimals = useLiveQuery(
    () => db.animals
      .orderBy('updated_at')
      .reverse()
      .filter(a => !a.deleted_at)
      .toArray()
  );

  const isLoading = rawAnimals === undefined || rawFarms === undefined;
  const farms = rawFarms || [];
  const potreros = rawPotreros || [];
  const owners = rawOwners || [];
  const allAnimals = rawAnimals || [];

  // Mapeos rápidos para nombres
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

  // Auditoría de usuarios y roles
  const rawUsuarios = useLiveQuery(() => db.usuarios.filter(u => !u.deleted_at).toArray()) || [];
  const currentUser = useMemo(() => getCurrentUser(), []);

  const usersMap = useMemo(() => {
    const map = {};
    rawUsuarios.forEach(u => {
      map[u.id] = {
        name: u.name || u.email?.split('@')[0] || 'Usuario',
        email: u.email || '',
        role: u.role || 'operador'
      };
    });
    return map;
  }, [rawUsuarios]);

  const getUserInfo = (userId) => {
    if (!userId) {
      return {
        name: currentUser?.name || currentUser?.email?.split('@')[0] || 'Administrador',
        role: currentUser?.role || 'admin'
      };
    }
    if (usersMap[userId]) {
      return usersMap[userId];
    }
    if (currentUser && currentUser.id === userId) {
      return {
        name: currentUser.name || currentUser.email?.split('@')[0] || 'Administrador',
        role: currentUser.role || 'admin'
      };
    }
    return {
      name: `Usuario #${userId.slice(0, 6)}`,
      role: 'operador'
    };
  };

  // Si cambia la finca seleccionada, resetear el potrero si no pertenece a la nueva finca
  const prevFarmIdRef = useRef(selectedFarmId);
  useEffect(() => {
    if (prevFarmIdRef.current !== selectedFarmId) {
      prevFarmIdRef.current = selectedFarmId;
      if (selectedFarmId === 'NONE') {
        setSelectedPotreroId('ALL');
      } else if (selectedFarmId !== 'ALL' && selectedPotreroId !== 'ALL') {
        const potreroBelongsToFarm = potreros.some(p => p.id === selectedPotreroId && p.farm_id === selectedFarmId);
        if (!potreroBelongsToFarm) {
          setSelectedPotreroId('ALL');
        }
      }
    }
  }, [selectedFarmId, selectedPotreroId, potreros]);

  // Si se elimina el potrero seleccionado de la base de datos local
  useEffect(() => {
    if (selectedPotreroId !== 'ALL') {
      const exists = potreros.some(p => p.id === selectedPotreroId);
      if (!exists) {
        setSelectedPotreroId('ALL');
      }
    }
  }, [potreros, selectedPotreroId]);

  // Potreros filtrados por la finca actual
  const currentFarmPotreros = useMemo(() => {
    if (selectedFarmId === 'ALL') return potreros;
    if (selectedFarmId === 'NONE') return [];
    return potreros.filter(p => p.farm_id === selectedFarmId);
  }, [potreros, selectedFarmId]);

  // Opciones estilizadas para CustomSelect
  const potreroOptions = useMemo(() => {
    const list = [
      {
        value: 'ALL',
        label: selectedFarmId === 'ALL' 
          ? 'Todos los Potreros' 
          : selectedFarmId === 'NONE'
            ? 'Sin Potreros'
            : `Todos los Potreros (${farmMap[selectedFarmId] || 'Finca'})`
      }
    ];
    currentFarmPotreros.forEach(p => {
      const farmName = farmMap[p.farm_id];
      const label = selectedFarmId === 'ALL' && farmName 
        ? `${p.name} (${farmName})`
        : p.name;
      list.push({ value: p.id, label });
    });
    return list;
  }, [selectedFarmId, farmMap, currentFarmPotreros]);

  const ownerOptions = useMemo(() => {
    const list = [
      { value: 'ALL', label: 'Todos los Dueños' }
    ];
    owners.forEach(o => {
      list.push({ value: o.id, label: o.name });
    });
    list.push({ value: 'NONE', label: 'Sin Dueño asignado' });
    return list;
  }, [owners]);

  const statusOptions = [
    { value: 'ALL', label: 'Todos los Estatus' },
    { value: 'Activo', label: 'Solo Activos' },
    { value: 'Inactivo', label: 'Solo Inactivos (Bajas)' }
  ];

  // Flujo de cierre de sesión
  const executeLogout = async () => {
    try {
      logoutUser();
      await clearLocalData();
      navigate('/login');
    } catch (err) {
      console.error('Error al ejecutar el cierre de sesión:', err);
    }
  };

  const handleLogoutFlow = async () => {
    try {
      let pendingCount = await db.sync_queue.count();
      if (pendingCount > 0 && navigator.onLine) {
        await forceFullResync();
        pendingCount = await db.sync_queue.count();
      }
      if (pendingCount > 0) {
        setPendingLogoutCount(pendingCount);
        setIsLogoutConfirmOpen(true);
      } else {
        await executeLogout();
      }
    } catch (err) {
      console.error('Error durante el cierre de sesión:', err);
    }
  };

  // Filtro de animales según los controles del Dashboard
  const filteredAnimals = useMemo(() => {
    return allAnimals.filter(animal => {
      // 1. Filtro de Finca
      if (selectedFarmId !== 'ALL') {
        if (selectedFarmId === 'NONE') {
          if (animal.farm_id) return false;
        } else if (animal.farm_id !== selectedFarmId) {
          return false;
        }
      }

      // 2. Filtro de Potrero
      if (selectedPotreroId !== 'ALL' && animal.potrero_id !== selectedPotreroId) {
        return false;
      }

      // 3. Filtro de Dueño
      if (selectedOwnerId !== 'ALL') {
        if (selectedOwnerId === 'NONE') {
          if (animal.owner_id) return false;
        } else if (animal.owner_id !== selectedOwnerId) {
          return false;
        }
      }

      // 4. Filtro de Estatus
      if (selectedStatus !== 'ALL') {
        const animalStatus = animal.status || 'Activo';
        if (animalStatus !== selectedStatus) return false;
      }

      return true;
    });
  }, [allAnimals, selectedFarmId, selectedPotreroId, selectedOwnerId, selectedStatus]);

  // =========================================================================
  // CÁLCULO DE MÉTRICAS Y ESTADÍSTICAS DEL REBAÑO
  // =========================================================================
  const metrics = useMemo(() => {
    const total = filteredAnimals.length;
    if (total === 0) {
      return {
        total: 0,
        activos: 0,
        inactivos: 0,
        hembras: 0,
        machos: 0,
        conChip: 0,
        conChipPct: 0,
        sinChip: 0,
        sinChipPct: 0,
        conObservaciones: 0,
        conObservacionesPct: 0,
        categorias: AGE_CATEGORIES.map(c => ({ ...c, count: 0, pct: 0 })),
        razas: [],
        porFinca: [],
        porPotrero: [],
        porDueno: [],
        recientes: []
      };
    }

    let activos = 0;
    let inactivos = 0;
    let hembras = 0;
    let machos = 0;
    let conChip = 0;
    let conObservaciones = 0;

    const catCounts = {
      'Becerro': 0,
      'Maute Macho': 0,
      'Maute Hembra': 0,
      'Novilla': 0,
      'Adulto': 0,
      'Desconocida': 0
    };

    const razasMap = {};
    const duenosMap = {};
    const potrerosMap = {};

    filteredAnimals.forEach(a => {
      // Estatus
      if (a.status === 'Inactivo') inactivos++;
      else activos++;

      // Sexo
      if (a.sex === 'Hembra') hembras++;
      else machos++;

      // Chip
      if (a.chip_number && a.chip_number.trim()) conChip++;

      // Observaciones
      if (a.observations && a.observations.trim()) conObservaciones++;

      // Categoría
      const cat = getAnimalAgeCategory(a);
      if (catCounts[cat] !== undefined) catCounts[cat]++;
      else catCounts['Desconocida']++;

      // Razas
      const razaName = (a.breed || '').trim() || 'Sin raza';
      razasMap[razaName] = (razasMap[razaName] || 0) + 1;

      // Dueños
      const duenoId = a.owner_id || 'NONE';
      duenosMap[duenoId] = (duenosMap[duenoId] || 0) + 1;

      // Potreros
      if (a.potrero_id) {
        potrerosMap[a.potrero_id] = (potrerosMap[a.potrero_id] || 0) + 1;
      }
    });

    const conChipPct = Math.round((conChip / total) * 100);
    const sinChip = total - conChip;
    const sinChipPct = Math.round((sinChip / total) * 100);
    const conObservacionesPct = Math.round((conObservaciones / total) * 100);

    const categorias = AGE_CATEGORIES.map(c => {
      const count = catCounts[c.id] || 0;
      const pct = Math.round((count / total) * 100);
      return { ...c, count, pct };
    });

    // Razas ordenadas por mayor frecuencia
    const razas = Object.entries(razasMap)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // Resumen de Fincas (sin promedio de peso)
    const porFinca = farms.map(f => {
      const fincaAnimals = allAnimals.filter(a => a.farm_id === f.id);
      const fincaHembras = fincaAnimals.filter(a => a.sex === 'Hembra').length;
      const fincaMachos = fincaAnimals.length - fincaHembras;
      const fincaPotrerosCount = potreros.filter(p => p.farm_id === f.id).length;

      return {
        id: f.id,
        name: f.name,
        location: f.location || 'Sin ubicación',
        count: fincaAnimals.length,
        pct: allAnimals.length > 0 ? Math.round((fincaAnimals.length / allAnimals.length) * 100) : 0,
        hembras: fincaHembras,
        machos: fincaMachos,
        potrerosCount: fincaPotrerosCount
      };
    }).sort((a, b) => b.count - a.count);

    // Potreros de la finca seleccionada o con animales
    const potrerosLista = (selectedFarmId === 'ALL' ? potreros : currentFarmPotreros).map(p => {
      const count = potrerosMap[p.id] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        farmName: farmMap[p.farm_id] || 'Finca',
        count,
        pct
      };
    }).sort((a, b) => b.count - a.count);

    // Dueños ordenados
    const porDueno = Object.entries(duenosMap)
      .map(([id, count]) => ({
        id,
        name: id === 'NONE' ? 'Sin dueño asignado' : (ownerMap[id] || 'Dueño'),
        count,
        pct: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // Animales recientes (últimos 10 registrados o modificados)
    const recientes = filteredAnimals.slice(0, 10);

    return {
      total,
      activos,
      inactivos,
      hembras,
      machos,
      conChip,
      conChipPct,
      sinChip,
      sinChipPct,
      conObservaciones,
      conObservacionesPct,
      categorias,
      razas,
      porFinca,
      porPotrero: potrerosLista,
      porDueno,
      recientes
    };
  }, [filteredAnimals, allAnimals, farms, potreros, currentFarmPotreros, farmMap, ownerMap, selectedFarmId]);

  // Contar cuántos filtros activos secundarios existen
  const activeSecondaryFiltersCount =
    (selectedPotreroId !== 'ALL' ? 1 : 0) +
    (selectedOwnerId !== 'ALL' ? 1 : 0) +
    (selectedStatus !== 'ALL' ? 1 : 0);

  // Conteo de animales sin finca asignada
  const sinFincaCount = useMemo(() => {
    return allAnimals.filter(a => !a.farm_id).length;
  }, [allAnimals]);

  return (
    <main className="min-h-screen bg-[#F0F2EB] font-sans pb-28 relative">
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

      {/* HEADER PRINCIPAL DEL DASHBOARD (Sin botón 'Ver Inventario') */}
      <header className="bg-white md:bg-[#1B4820] w-full px-4 pt-4 pb-4 md:py-4 md:px-8 sticky top-0 z-30 shadow-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Identificación y Título */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 rounded-2xl text-[#1B4820] md:text-white hover:bg-[#1B4820]/10 md:hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
              title="Abrir menú de navegación"
            >
              <Menu className="w-6 h-6 text-[#1B4820] md:text-white" />
            </button>
            <h1 className="text-xl md:text-2xl font-black text-[#1B4820] md:text-white tracking-tight leading-none">
              Dashboard
            </h1>
          </div>

          {/* SyncStatus */}
          <div>
            <SyncStatus />
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-5 md:mt-6 space-y-6">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. SELECTOR PROMINENTE DE FINCA (CAROUSEL / TABS HORIZONTALES)            */}
            {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1B4820]" />
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900">
                Seleccionar Finca
              </span>
            </div>
            {selectedFarmId !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedFarmId('ALL')}
                className="text-[11px] font-bold text-[#1B4820] hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Ver Todas</span>
              </button>
            )}
          </div>

          {/* Pills de Fincas con Scroll Horizontal Fluido */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
            {/* Todas las Fincas */}
            <button
              type="button"
              onClick={() => setSelectedFarmId('ALL')}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                selectedFarmId === 'ALL'
                  ? 'bg-[#1B4820] text-white shadow-md shadow-[#1B4820]/25 scale-[1.02]'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              <GiCow className="w-4 h-4" />
              <span>Todas las Fincas</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                selectedFarmId === 'ALL' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}>
                {allAnimals.length}
              </span>
            </button>

            {/* Cada Finca Registrada */}
            {farms.map(f => {
              const count = allAnimals.filter(a => a.farm_id === f.id).length;
              const isSelected = selectedFarmId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFarmId(f.id)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1B4820] text-white shadow-md shadow-[#1B4820]/25 scale-[1.02]'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 opacity-70" />
                  <span className="truncate max-w-[150px]">{f.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Sin Finca Asignada */}
            {sinFincaCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFarmId('NONE')}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                  selectedFarmId === 'NONE'
                    ? 'bg-[#1B4820] text-white shadow-md shadow-[#1B4820]/25 scale-[1.02]'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <span className="italic">Sin Finca</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  selectedFarmId === 'NONE' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}>
                  {sinFincaCount}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. SUB-FILTROS ESTILIZADOS (CON CustomSelect)                             */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#1B4820]" />
              <span>Filtros Secundarios</span>
            </span>
            {activeSecondaryFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPotreroId('ALL');
                  setSelectedOwnerId('ALL');
                  setSelectedStatus('ALL');
                }}
                className="text-[11px] font-black text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/80 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer ({activeSecondaryFiltersCount})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CustomSelect
              value={selectedPotreroId}
              onChange={setSelectedPotreroId}
              options={potreroOptions}
              placeholder="Seleccionar Potrero"
              label="Potrero"
              bgClass="bg-neutral-50"
            />
            <CustomSelect
              value={selectedOwnerId}
              onChange={setSelectedOwnerId}
              options={ownerOptions}
              placeholder="Seleccionar Dueño"
              label="Dueño / Propietario"
              bgClass="bg-neutral-50"
            />
            <CustomSelect
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={statusOptions}
              placeholder="Seleccionar Estatus"
              label="Estatus"
              bgClass="bg-neutral-50"
            />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. BLOQUE DE MÉTRICAS CLAVE (3 KPI CARDS: POBLACIÓN, SEXO, CONTROL)       */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* KPI 1: TOTAL DE CABEZAS */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                Población Total
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-[#1B4820] flex items-center justify-center">
                <GiCow className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                {metrics.total}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-neutral-500">
                <span className="text-emerald-700 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {metrics.activos} activos
                </span>
                {metrics.inactivos > 0 && (
                  <span className="text-neutral-400">
                    • {metrics.inactivos} inactivos
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPI 2: DISTRIBUCIÓN POR SEXO (SOLO 2 NÚMEROS: HEMBRAS Y MACHOS) */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                Distribución por Sexo
              </span>
              <div className="flex items-center -space-x-1">
                <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-xs">
                  <FaVenus />
                </div>
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                  <FaMars />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Hembras */}
              <div className="bg-pink-50/70 border border-pink-100 rounded-2xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-black uppercase text-pink-700 tracking-wider">
                  <FaVenus className="w-3 h-3" />
                  <span>Hembras</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-pink-900 mt-0.5">
                  {metrics.hembras}
                </div>
              </div>

              {/* Machos */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-black uppercase text-blue-700 tracking-wider">
                  <FaMars className="w-3 h-3" />
                  <span>Machos</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-blue-900 mt-0.5">
                  {metrics.machos}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 3: IDENTIFICACIÓN Y OBSERVACIONES (Sin alerta de 8 meses) */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                Control & Identificación
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
              {/* Con Chip */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-2 sm:p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-black uppercase text-blue-700 tracking-wider truncate">
                  <Cpu className="w-3 h-3 shrink-0" />
                  <span className="truncate">Con Chip</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">
                  {metrics.conChip}
                </div>
              </div>

              {/* Sin Chip */}
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-2 sm:p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-black uppercase text-neutral-600 tracking-wider truncate">
                  <Cpu className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span className="truncate">Sin Chip</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-neutral-800 mt-0.5">
                  {metrics.sinChip}
                </div>
              </div>

              {/* Con Observación */}
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-2 sm:p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-black uppercase text-amber-700 tracking-wider truncate">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">Observaciones</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">
                  {metrics.conObservaciones}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. PIRÁMIDE DEL REBAÑO (CATEGORÍAS POR EDAD)                              */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-base font-black text-neutral-900">
                Estructura Etaria del Rebaño
              </h2>
              <p className="text-[11px] font-medium text-neutral-400">
                Distribución por etapas productivas y categorías biológicas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.categorias.map(cat => (
              <div
                key={cat.id}
                className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/60 flex flex-col justify-between space-y-2 hover:bg-neutral-100/80 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-neutral-800">
                    {cat.label}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cat.badge}`}>
                    {cat.pct}%
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-neutral-900">
                    {cat.count}
                  </span>
                  <span className="text-[11px] font-bold text-neutral-400">
                    cabezas
                  </span>
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-neutral-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${cat.pct}%` }}
                    className={`h-full bg-gradient-to-r ${cat.color} rounded-full transition-all duration-500`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. RESUMEN POR FINCAS Y OCUPACIÓN DE POTREROS                             */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 5A. Tarjeta: Distribución por Fincas (Sin promedio de peso) */}
          <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#1B4820]" />
                <div>
                  <h3 className="text-base font-black text-neutral-900">
                    Resumen por Fincas ({farms.length})
                  </h3>
                  <p className="text-[11px] font-medium text-neutral-400">
                    Carga animal por propiedad
                  </p>
                </div>
              </div>
            </div>

            {metrics.porFinca.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4 text-center">
                No hay fincas registradas aún.
              </p>
            ) : (
              <div className="space-y-3">
                {metrics.porFinca.map(f => {
                  const isSelected = selectedFarmId === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFarmId(f.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-[#1B4820] bg-emerald-50/50 shadow-xs'
                          : 'border-neutral-200/70 hover:border-neutral-300 bg-neutral-50/50 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-neutral-900 truncate">
                            {f.name}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-black uppercase bg-[#1B4820] text-white px-1.5 py-0.5 rounded-md">
                              Filtrado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-neutral-500 mt-1 flex-wrap">
                          <span>{f.potrerosCount} potreros</span>
                          <span>•</span>
                          <span className="text-pink-700">{f.hembras} H</span>
                          <span>/</span>
                          <span className="text-blue-700">{f.machos} M</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xl font-black text-neutral-900">
                          {f.count}
                        </div>
                        <div className="text-[10px] font-bold text-neutral-400">
                          {f.pct}% del total
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 5B. Tarjeta: Ocupación de Potreros (No clickeable) */}
          <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Fence className="w-5 h-5 text-[#1B4820]" />
                <div>
                  <h3 className="text-base font-black text-neutral-900">
                    Ocupación de Potreros ({metrics.porPotrero.length})
                  </h3>
                  <p className="text-[11px] font-medium text-neutral-400">
                    {selectedFarmId === 'ALL'
                      ? 'Animales distribuidos en potreros'
                      : `Potreros pertenecientes a ${farmMap[selectedFarmId] || 'la finca'}`}
                  </p>
                </div>
              </div>
            </div>

            {metrics.porPotrero.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4 text-center">
                No hay potreros asociados a este filtro.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {metrics.porPotrero.map(p => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 flex items-center justify-between gap-3 select-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-neutral-900 truncate">
                          {p.name}
                        </span>
                        {selectedFarmId === 'ALL' && (
                          <span className="text-[10px] text-neutral-400 font-bold truncate">
                            ({p.farmName})
                          </span>
                        )}
                      </div>
                      {/* Barra de proporción */}
                      <div className="w-full bg-neutral-200/70 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          style={{ width: `${p.pct}%` }}
                          className="h-full bg-[#1B4820] rounded-full"
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-neutral-900">
                        {p.count} cabezas
                      </span>
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        {p.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ========================================================================= */}
        {/* 6. DISTRIBUCIÓN POR DUEÑO Y POR RAZA                                     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 6A. Dueños / Propietarios (No clickeable) */}
          <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#1B4820]" />
                <div>
                  <h3 className="text-base font-black text-neutral-900">
                    Rebaño por Dueño / Propietario
                  </h3>
                  <p className="text-[11px] font-medium text-neutral-400">
                    Tenencia y propiedad del ganado
                  </p>
                </div>
              </div>
            </div>

            {metrics.porDueno.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4 text-center">
                Sin datos de dueños.
              </p>
            ) : (
              <div className="space-y-2.5">
                {metrics.porDueno.map(d => (
                  <div
                    key={d.id}
                    className="p-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 flex items-center justify-between gap-3 select-none"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-black text-xs text-neutral-900 truncate block">
                        {d.name}
                      </span>
                      <div className="w-full bg-neutral-200/70 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          style={{ width: `${d.pct}%` }}
                          className="h-full bg-emerald-700 rounded-full"
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-neutral-900">
                        {d.count} cabezas
                      </span>
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        {d.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 6B. Razas Registradas */}
          <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Dna className="w-5 h-5 text-[#1B4820]" />
                <div>
                  <h3 className="text-base font-black text-neutral-900">
                    Composición Racial del Rebaño
                  </h3>
                  <p className="text-[11px] font-medium text-neutral-400">
                    Genética y linajes presentes en el lote
                  </p>
                </div>
              </div>
            </div>

            {metrics.razas.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4 text-center">
                Sin datos de razas.
              </p>
            ) : (
              <div className="space-y-2.5">
                {metrics.razas.map(r => (
                  <div
                    key={r.name}
                    className="p-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-black text-xs text-neutral-900 truncate block">
                        {r.name}
                      </span>
                      <div className="w-full bg-neutral-200/70 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          style={{ width: `${r.pct}%` }}
                          className="h-full bg-purple-600 rounded-full"
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-neutral-900">
                        {r.count} cabezas
                      </span>
                      <span className="text-[10px] text-neutral-400 block font-bold">
                        {r.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ========================================================================= */}
        {/* 7. ACTIVIDAD RECIENTE: HISTORIAL DE MODIFICACIONES (TABLA ÚLTIMOS 10)     */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#1B4820]" />
                <h3 className="text-base font-black text-neutral-900">
                  Historial de Cambios Recientes (Últimos 10)
                </h3>
              </div>
              <p className="text-[11px] font-medium text-neutral-400 mt-0.5">
                Auditoría técnica de registros y modificaciones realizadas por el administrador y obreros
              </p>
            </div>
            <Link
              to="/inventario"
              className="text-xs font-black text-[#1B4820] hover:underline flex items-center gap-1 self-start sm:self-auto shrink-0"
            >
              <span>Ver Catálogo Completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {metrics.recientes.length === 0 ? (
            <p className="text-xs text-neutral-400 italic py-6 text-center">
              No hay animales registrados.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead>
                  <tr className="border-b border-neutral-200/80 text-[11px] font-black uppercase tracking-wider text-neutral-500 bg-neutral-50/70 select-none">
                    <th className="py-3 px-3.5 rounded-l-xl">Número / Nombre</th>
                    <th className="py-3 px-3.5">Microchip</th>
                    <th className="py-3 px-3.5">Modificado Por</th>
                    <th className="py-3 px-3.5">Fecha y Hora</th>
                    <th className="py-3 px-3.5 text-right rounded-r-xl">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-700">
                  {metrics.recientes.map((animal) => {
                    const userInfo = getUserInfo(animal.user_id);
                    return (
                      <tr
                        key={animal.id}
                        onClick={() => navigate(`/inventario/perfil?id=${animal.id}`)}
                        className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                      >
                        {/* 1. Número y Nombre debajo (sin icono de género) */}
                        <td className="py-3 px-3.5">
                          <span className="font-black text-sm text-[#1B4820] block leading-snug">
                            {animal.number ? `#${animal.number}` : (animal.name || 'Sin arete')}
                          </span>
                          {animal.name && animal.number && (
                            <span className="text-[11px] font-bold text-neutral-500 truncate block leading-tight">
                              {animal.name}
                            </span>
                          )}
                        </td>

                        {/* 2. Microchip */}
                        <td className="py-3 px-3.5">
                          {animal.chip_number ? (
                            <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                              <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-mono text-xs">{animal.chip_number}</span>
                            </div>
                          ) : (
                            <span className="text-neutral-400 font-normal italic">Sin chip</span>
                          )}
                        </td>

                        {/* 3. Quién hizo el cambio */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-neutral-900">
                              {userInfo.name}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full leading-none ${
                                userInfo.role === 'admin'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : userInfo.role === 'obrero'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {userInfo.role}
                            </span>
                          </div>
                        </td>

                        {/* 4. Fecha y Hora */}
                        <td className="py-3 px-3.5 text-neutral-500 whitespace-nowrap">
                          {formatDateTime(animal.updated_at || animal.created_at)}
                        </td>

                        {/* 5. Acción */}
                        <td className="py-3 px-3.5 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#1B4820] group-hover:translate-x-0.5 transition-transform">
                            <span>Ficha</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALES REUTILIZABLES PARA GESTIÓN DESDE EL DASHBOARD                     */}
      {/* ========================================================================= */}

      {/* MODAL GESTIÓN DE FINCAS */}
      <FarmModal
        isOpen={isFarmModalOpen}
        onClose={() => setIsFarmModalOpen(false)}
        onFarmCreated={(farm) => {
          showToast('¡Finca creada con éxito!', `La finca "${farm.name}" fue registrada.`);
        }}
        onFarmUpdated={(farm) => {
          showToast('¡Finca actualizada!', `Los cambios en "${farm.name}" fueron guardados.`);
        }}
      />

      {/* MODAL GESTIÓN DE POTREROS */}
      <PotreroModal
        isOpen={isPotreroModalOpen}
        onClose={() => setIsPotreroModalOpen(false)}
        defaultFarmId={selectedFarmId !== 'ALL' && selectedFarmId !== 'NONE' ? selectedFarmId : ''}
        onPotreroCreated={(pot) => {
          showToast('¡Potrero creado con éxito!', `El potrero "${pot.name}" fue registrado.`);
        }}
        onPotreroUpdated={(pot) => {
          showToast('¡Potrero actualizado!', `Los cambios en "${pot.name}" fueron guardados.`);
        }}
      />

      {/* MODAL GESTIÓN DE DUEÑOS */}
      <OwnerModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        onFarmCreated={(owner) => {
          showToast('¡Dueño creado con éxito!', `"${owner.name}" fue registrado.`);
        }}
        onOwnerUpdated={(owner) => {
          showToast('¡Dueño actualizado!', `Los cambios en "${owner.name}" fueron guardados.`);
        }}
      />

      {/* DIÁLOGO CONFIRMACIÓN CIERRE DE SESIÓN */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="Cambios pendientes sin sincronizar"
        description={`Tienes ${pendingLogoutCount} cambio(s) guardado(s) en este dispositivo que aún no se han subido al servidor. Si cierras sesión ahora, estos cambios locales se perderán definitivamente.`}
        confirmText="Cerrar sesión de todos modos"
        cancelText="Volver y sincronizar"
        isDestructive={true}
        onConfirm={executeLogout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />

      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
