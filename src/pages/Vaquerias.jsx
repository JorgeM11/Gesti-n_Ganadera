import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ClipboardCheck, 
  Plus, 
  Menu, 
  Building2, 
  Calendar, 
  ChevronRight, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { db, clearLocalData } from '@/lib/db';
import { logoutUser } from '@/lib/authService';
import { deleteVaqueria } from '@/lib/vaqueriaUtils';
import SyncStatus from '@/components/ui/SyncStatus';
import NavigationDrawer from '@/components/inventario/NavigationDrawer';
import FarmModal from '@/components/inventario/FarmModal';
import PotreroModal from '@/components/inventario/PotreroModal';
import OwnerModal from '@/components/inventario/OwnerModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Toast from '@/components/ui/Toast';
import VaqueriaModal from '@/components/vaqueria/VaqueriaModal';
import { useForceResync } from '@/hooks/useForceResync';

export default function VaqueriasPage() {
  const navigate = useNavigate();

  // Estados de navegación y modales
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPotreroModalOpen, setIsPotreroModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [isVaqueriaModalOpen, setIsVaqueriaModalOpen] = useState(false);
  const [editingVaqueria, setEditingVaqueria] = useState(null);
  const [deletingVaqueriaId, setDeletingVaqueriaId] = useState(null);
  const [selectedFarmId, setSelectedFarmId] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);

  // Estados de cierre de sesión
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [pendingLogoutCount, setPendingLogoutCount] = useState(0);

  // Hook de sincronización forzada
  const { isResyncing, resyncSuccess, handleForceSync } = useForceResync();

  const showToast = (title, message, type = 'success') => {
    setToast({ id: Date.now(), title, message, type });
  };

  // Consultas Dexie (100% offline)
  const farms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const potreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray()) || [];
  const owners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];
  const rawVaquerias = useLiveQuery(
    () => db.vaquerias.filter(v => !v.deleted_at).toArray()
  ) || [];
  const allVaqueriaAnimals = useLiveQuery(
    () => db.vaqueria_animals.filter(r => !r.deleted_at).toArray()
  ) || [];

  const farmsById = useMemo(() => {
    const map = new Map();
    farms.forEach(f => map.set(f.id, f));
    return map;
  }, [farms]);

  // Contar presentes por vaquería
  const countsByVaqueria = useMemo(() => {
    const counts = new Map();
    allVaqueriaAnimals.forEach(rec => {
      counts.set(rec.vaqueria_id, (counts.get(rec.vaqueria_id) || 0) + 1);
    });
    return counts;
  }, [allVaqueriaAnimals]);

  // Filtrado y ordenamiento de vaquerías
  const filteredVaquerias = useMemo(() => {
    return rawVaquerias
      .filter(v => {
        if (selectedFarmId !== 'ALL' && v.farm_id !== selectedFarmId) {
          return false;
        }
        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          const matchName = (v.name || '').toLowerCase().includes(q);
          const farmName = (farmsById.get(v.farm_id)?.name || '').toLowerCase();
          const matchFarm = farmName.includes(q);
          return matchName || matchFarm;
        }
        return true;
      })
      .sort((a, b) => {
        const dateComp = (b.date || '').localeCompare(a.date || '');
        if (dateComp !== 0) return dateComp;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [rawVaquerias, selectedFarmId, searchTerm, farmsById]);

  const handleOpenCreate = () => {
    setEditingVaqueria(null);
    setIsVaqueriaModalOpen(true);
  };

  const handleOpenEdit = (v, e) => {
    e.stopPropagation();
    setEditingVaqueria(v);
    setIsVaqueriaModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingVaqueriaId) return;
    try {
      await deleteVaqueria(deletingVaqueriaId);
      showToast('Vaquería eliminada', 'La sesión fue eliminada correctamente.', 'success');
    } catch (err) {
      showToast('Error', err.message || 'No se pudo eliminar la vaquería.', 'error');
    } finally {
      setDeletingVaqueriaId(null);
    }
  };

  // Manejo de Logout
  const handleLogoutClick = async () => {
    const pendingCount = await db.sync_queue.where('status').anyOf(['PENDING', 'ERROR']).count();
    setPendingLogoutCount(pendingCount);
    setIsLogoutConfirmOpen(true);
  };

  const executeLogout = async () => {
    setIsLogoutConfirmOpen(false);
    await clearLocalData();
    logoutUser();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F0F2EB] flex flex-col font-sans select-none pb-24 md:pb-12">
      {/* 1. Header Superior Responsive */}
      <header className="bg-white md:bg-[#1B4820] w-full px-4 pt-4 pb-3 md:py-4 md:px-8 border-b border-neutral-200 md:border-none shadow-xs sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 -ml-2 rounded-xl text-neutral-700 md:text-white hover:bg-neutral-100 md:hover:bg-white/10 transition-colors cursor-pointer"
              title="Abrir menú"
            >
              <Menu className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#1B4820] md:bg-white/10 text-white flex items-center justify-center shadow-xs">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-black text-neutral-900 md:text-white tracking-tight leading-tight">
                  Vaquería
                </h1>
                <p className="text-[11px] font-bold text-neutral-400 md:text-emerald-200/80 hidden sm:block">
                  Control y pase de asistencia periódica por finca
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SyncStatus />
            <button
              type="button"
              onClick={handleOpenCreate}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#1B4820] md:bg-white text-white md:text-[#1B4820] rounded-xl text-xs font-black shadow-md hover:bg-[#143618] md:hover:bg-neutral-100 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Nueva Vaquería
            </button>
          </div>
        </div>
      </header>

      {/* 2. Contenido Central Fluid Grid */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-5 md:mt-8 flex-1">
        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-neutral-200/70 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre de vaquería o finca..."
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-[#1B4820] focus:ring-2 focus:ring-[#1B4820]/15 outline-none transition-all"
              />
            </div>

            {/* Contador */}
            <div className="text-xs font-bold text-neutral-500 shrink-0 self-center">
              {filteredVaquerias.length} {filteredVaquerias.length === 1 ? 'vaquería' : 'vaquerías'}
            </div>
          </div>

          {/* Selector de Fincas (Pills Horizontales) */}
          <div>
            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#1B4820]" /> Filtrar por Finca
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedFarmId('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                  selectedFarmId === 'ALL'
                    ? 'bg-[#1B4820] text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
                }`}
              >
                Todas las Fincas
              </button>

              {farms.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFarmId(f.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                    selectedFarmId === f.id
                      ? 'bg-[#1B4820] text-white shadow-sm'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Listado de Vaquerías */}
        {filteredVaquerias.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 md:p-12 text-center border border-neutral-200/80 shadow-xs flex flex-col items-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#1B4820] flex items-center justify-center mb-4 shadow-inner">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-neutral-900 mb-1">
              No hay vaquerías registradas
            </h3>
            <p className="text-xs font-medium text-neutral-500 mb-6 text-center max-w-sm">
              Las vaquerías te permiten pasar asistencia periódica al rebaño en una finca, verificar animales presentes, detectar nuevos y registrar faltantes.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="py-3 px-6 bg-[#1B4820] text-white rounded-2xl text-xs font-black shadow-lg shadow-[#1B4820]/25 hover:bg-[#143618] transition-all cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Crear Primera Vaquería
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredVaquerias.map(v => {
              const farm = farmsById.get(v.farm_id);
              const presentCount = countsByVaqueria.get(v.id) || 0;
              const isFinalized = v.status === 'Finalizada';

              return (
                <div
                  key={v.id}
                  onClick={() => navigate(`/vaquerias/${v.id}`)}
                  className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs hover:shadow-md hover:border-[#1B4820]/40 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Barra lateral de estado */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                    isFinalized ? 'bg-neutral-300' : 'bg-[#1B4820]'
                  }`} />

                  <div>
                    {/* Top Row: Finca y Estado */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 text-[11px] font-black truncate">
                        <Building2 className="w-3.5 h-3.5 text-[#1B4820] shrink-0" />
                        {farm?.name || 'Finca no asignada'}
                      </span>

                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        isFinalized 
                          ? 'bg-neutral-100 text-neutral-600' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {v.status || 'En progreso'}
                      </span>
                    </div>

                    {/* Nombre de la Vaquería */}
                    <h3 className="text-base font-black text-neutral-900 group-hover:text-[#1B4820] transition-colors line-clamp-1 mb-1">
                      {v.name}
                    </h3>

                    {/* Fecha y Notas */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 mb-3">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{v.date || 'Sin fecha'}</span>
                    </div>

                    {v.observations && (
                      <p className="text-xs font-medium text-neutral-500 line-clamp-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 mb-3">
                        {v.observations}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Métricas y Acciones */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1B4820] flex items-center justify-center font-black text-xs">
                        {presentCount}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Presentes</span>
                        <span className="text-xs font-black text-neutral-800">{presentCount} cabezas</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(v, e)}
                        className="p-2 text-neutral-400 hover:text-[#1B4820] hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                        title="Editar información"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingVaqueriaId(v.id);
                        }}
                        className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Eliminar vaquería"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="w-7 h-7 rounded-lg bg-neutral-100 group-hover:bg-[#1B4820] text-neutral-600 group-hover:text-white flex items-center justify-center transition-colors ml-1">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Botón Flotante en Móvil (FAB) */}
      <button
        type="button"
        onClick={handleOpenCreate}
        className="sm:hidden fixed right-5 bottom-6 z-40 w-14 h-14 rounded-full bg-[#1B4820] text-white flex items-center justify-center shadow-xl shadow-[#1B4820]/40 active:scale-95 transition-all cursor-pointer"
        title="Nueva Vaquería"
      >
        <Plus className="w-7 h-7 stroke-[3]" />
      </button>

      {/* Modales y Drawer */}
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
        onLogout={handleLogoutClick}
      />

      <FarmModal
        isOpen={isFarmModalOpen}
        onClose={() => setIsFarmModalOpen(false)}
      />

      <PotreroModal
        isOpen={isPotreroModalOpen}
        onClose={() => setIsPotreroModalOpen(false)}
      />

      <OwnerModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
      />

      <VaqueriaModal
        isOpen={isVaqueriaModalOpen}
        onClose={() => {
          setIsVaqueriaModalOpen(false);
          setEditingVaqueria(null);
        }}
        initialData={editingVaqueria}
        initialFarmId={selectedFarmId !== 'ALL' ? selectedFarmId : ''}
        onSuccess={(v) => {
          showToast(
            editingVaqueria ? 'Vaquería actualizada' : 'Vaquería creada',
            `"${v.name}" se guardó exitosamente.`,
            'success'
          );
          if (!editingVaqueria) {
            navigate(`/vaquerias/${v.id}`);
          }
        }}
      />

      {/* Confirmación de Borrado */}
      <ConfirmDialog
        isOpen={Boolean(deletingVaqueriaId)}
        title="¿Eliminar esta Vaquería?"
        message="Se eliminará la sesión de vaquería y su registro de asistencia. Los animales del inventario permanecerán intactos."
        confirmText="Eliminar Vaquería"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingVaqueriaId(null)}
      />

      {/* Confirmación de Cierre de Sesión */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="¿Cerrar sesión?"
        message={
          pendingLogoutCount > 0
            ? `Tienes ${pendingLogoutCount} cambios pendientes por sincronizar en la nube. Si cierras sesión ahora en este dispositivo, se descartarán para proteger la privacidad. ¿Deseas cerrar sesión de todas formas?`
            : "¿Estás seguro de que deseas salir del sistema?"
        }
        confirmText={pendingLogoutCount > 0 ? "Descartar y Salir" : "Cerrar Sesión"}
        cancelText="Permanecer aquí"
        isDestructive={true}
        onConfirm={executeLogout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
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
