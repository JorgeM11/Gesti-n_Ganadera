import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  HardHat, 
  ShieldAlert, 
  Building2, 
  Pencil, 
  Power, 
  Check, 
  X, 
  Menu, 
  Plus,
  AlertTriangle,
  UserX,
  Mail
} from 'lucide-react';
import { db } from '@/lib/db';
import { getCurrentUser, logoutUser } from '@/lib/authService';
import { toggleUserStatus } from '@/lib/userService';
import { useForceResync } from '@/hooks/useForceResync';
import UserModal from '@/components/usuarios/UserModal';
import NavigationDrawer from '@/components/inventario/NavigationDrawer';
import SyncStatus from '@/components/ui/SyncStatus';
import FarmModal from '@/components/inventario/FarmModal';
import PotreroModal from '@/components/inventario/PotreroModal';
import OwnerModal from '@/components/inventario/OwnerModal';

export default function Usuarios() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getCurrentUser(), []);

  // Hook de sincronización forzada
  const { isResyncing, resyncSuccess, handleForceSync } = useForceResync();

  // Estados de navegación y modales
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPotreroModalOpen, setIsPotreroModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'operador' | 'obrero' | 'INACTIVOS'

  // Modal de confirmación para inactivar / activar
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // Consultas reactivas Dexie
  const rawUsers = useLiveQuery(() => db.usuarios.filter(u => !u.deleted_at).toArray()) || [];
  const rawFarms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];
  const rawPotreros = useLiveQuery(() => db.potreros.filter(p => !p.deleted_at).toArray()) || [];
  const rawOwners = useLiveQuery(() => db.owners.filter(o => !o.deleted_at).toArray()) || [];
  const rawUsuarioFarms = useLiveQuery(() => db.usuario_farms.filter(uf => !uf.deleted_at).toArray()) || [];

  // Mapa de fincas por ID para resolución rápida de nombres
  const farmMap = useMemo(() => {
    const map = new Map();
    rawFarms.forEach(f => map.set(f.id, f));
    return map;
  }, [rawFarms]);

  // Mapa de fincas asignadas por cada usuario obrero
  const userFarmsMap = useMemo(() => {
    const map = new Map();
    rawUsuarioFarms.forEach(uf => {
      if (!map.has(uf.user_id)) {
        map.set(uf.user_id, []);
      }
      const farm = farmMap.get(uf.farm_id);
      if (farm) {
        map.get(uf.user_id).push(farm);
      }
    });
    return map;
  }, [rawUsuarioFarms, farmMap]);

  // Estadísticas generales de usuarios
  const stats = useMemo(() => {
    let operadores = 0;
    let obreros = 0;
    let inactivos = 0;

    rawUsers.forEach(u => {
      if (u.status === 'Inactivo') {
        inactivos++;
      }
      if (u.role === 'operador') operadores++;
      if (u.role === 'obrero') obreros++;
    });

    return {
      total: rawUsers.length,
      operadores,
      obreros,
      inactivos
    };
  }, [rawUsers]);

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return rawUsers.filter(user => {
      // Filtro por estado / rol
      if (roleFilter === 'INACTIVOS') {
        if (user.status !== 'Inactivo') return false;
      } else if (roleFilter !== 'ALL') {
        if (user.role !== roleFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      if (a.status === 'Activo' && b.status === 'Inactivo') return -1;
      if (b.status === 'Activo' && a.status === 'Inactivo') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [rawUsers, roleFilter]);

  const handleOpenCreate = () => {
    setSelectedUserToEdit(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setSelectedUserToEdit(user);
    setIsUserModalOpen(true);
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = await toggleUserStatus(user.id);
      showToast(
        newStatus === 'Activo'
          ? `Usuario ${user.name} activado con éxito.`
          : `Usuario ${user.name} inactivado. Ya no podrá acceder al sistema.`
      );
      setConfirmToggleUser(null);
    } catch (err) {
      console.error('Error al cambiar estado del usuario:', err);
      showToast('Error al actualizar el estado del usuario.', 'error');
    }
  };

  const handleLogoutFlow = async () => {
    try {
      if (navigator.onLine) {
        await handleForceSync();
      }
      logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('Error durante el cierre de sesión:', err);
      logoutUser();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-neutral-800 pb-28">
      {/* ========================================================================= */}
      {/* HEADER PRINCIPAL (VERDE IDÉNTICO A INVENTARIO, INACTIVOS Y VAQUERÍAS)     */}
      {/* ========================================================================= */}
      <header className="bg-white md:bg-[#1B4820] w-full px-4 pt-4 pb-4 md:py-4 md:px-8 sticky top-0 z-30 shadow-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Lado izquierdo: Botón Menú Hamburguesa + Título */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 rounded-2xl text-[#1B4820] md:text-white hover:bg-[#1B4820]/10 md:hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
              title="Abrir menú de navegación"
            >
              <Menu className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-3xl font-black text-[#1B4820] md:text-white tracking-tight whitespace-nowrap">
                Usuarios
              </h1>
            </div>
          </div>

          {/* Lado derecho: Estado de Sincronización */}
          <div className="flex items-center gap-2">
            <SyncStatus />
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CONTENIDO PRINCIPAL                                                       */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-5 md:mt-8 space-y-6">
        {/* Toast Notificación */}
        <AnimatePresence>
          {toast.show && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className={`fixed top-20 right-4 sm:right-8 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-bold border ${
                toast.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selector de Filtros de Rol */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setRoleFilter('ALL')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
              roleFilter === 'ALL'
                ? 'bg-[#1B4820] text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
            }`}
          >
            Todos ({stats.total})
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter('operador')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-xs ${
              roleFilter === 'operador'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Operadores ({stats.operadores})</span>
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter('obrero')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-xs ${
              roleFilter === 'obrero'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>Obreros ({stats.obreros})</span>
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter('INACTIVOS')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-xs ${
              roleFilter === 'INACTIVOS'
                ? 'bg-neutral-800 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
            }`}
          >
            <UserX className="w-4 h-4" />
            <span>Inactivos ({stats.inactivos})</span>
          </button>
        </div>

        {/* Listado de Usuarios */}
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-neutral-200/80 text-center space-y-3 shadow-xs max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#1B4820] flex items-center justify-center mx-auto shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-neutral-900">No se encontraron usuarios</h3>
            <p className="text-xs text-neutral-500 font-medium max-w-sm mx-auto">
              No hay usuarios registrados bajo este filtro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUser?.id;
              const assignedFarms = userFarmsMap.get(user.id) || [];
              const isActive = user.status === 'Activo';

              return (
                <div
                  key={user.id}
                  className={`bg-white rounded-3xl p-5 sm:p-6 border transition-all flex flex-col justify-between gap-4.5 ${
                    !isActive
                      ? 'border-neutral-200/60 opacity-75 bg-neutral-50/50'
                      : user.role === 'admin'
                        ? 'border-emerald-200 shadow-xs ring-1 ring-emerald-500/15'
                        : 'border-neutral-200/80 shadow-xs hover:shadow-md'
                  }`}
                >
                  {/* Encabezado de la Tarjeta */}
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 truncate">
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-xs ${
                          user.role === 'admin'
                            ? 'bg-[#1B4820] text-white shadow-emerald-900/10'
                            : user.role === 'operador'
                              ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-600/10'
                              : 'bg-amber-100 text-amber-800 ring-2 ring-amber-600/10'
                        }`}>
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>

                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-black text-base text-neutral-900 truncate leading-snug">
                              {user.name}
                            </h4>
                            {isSelf && (
                              <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md shrink-0">
                                Tú
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-neutral-400 font-medium truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </span>
                        </div>
                      </div>

                      {/* Estado */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span>{user.status || 'Activo'}</span>
                      </span>
                    </div>

                    {/* Insignia de Rol */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider ${
                        user.role === 'admin'
                          ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-300/60'
                          : user.role === 'operador'
                            ? 'bg-blue-100/80 text-blue-900 border border-blue-300/60'
                            : 'bg-amber-100/80 text-amber-900 border border-amber-300/60'
                      }`}>
                        {user.role === 'admin' && <ShieldAlert className="w-3.5 h-3.5" />}
                        {user.role === 'operador' && <ShieldCheck className="w-3.5 h-3.5" />}
                        {user.role === 'obrero' && <HardHat className="w-3.5 h-3.5" />}
                        <span>{user.role}</span>
                      </span>
                    </div>

                    {/* Sección descriptiva según Rol */}
                    {user.role === 'admin' && (
                      <p className="text-[11px] text-neutral-500 font-medium leading-relaxed bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                        Administrador titular con control total de la base de datos, inventario y cuentas de usuario.
                      </p>
                    )}

                    {user.role === 'operador' && (
                      <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/80 space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-900 font-bold text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                          <span>Acceso Global a Fincas</span>
                        </div>
                        <p className="text-[10.5px] text-neutral-600 font-medium leading-relaxed">
                          Visualiza todo el inventario, dashboard y eventos. No requiere asignación de fincas.
                        </p>
                      </div>
                    )}

                    {user.role === 'obrero' && (
                      <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-amber-700" />
                            Fincas Asignadas ({assignedFarms.length})
                          </span>
                        </div>

                        {assignedFarms.length === 0 ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Sin fincas asignadas (acceso bloqueado)</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {assignedFarms.map(farm => (
                              <span
                                key={farm.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-amber-200/80 text-[11px] font-bold text-neutral-800 shadow-2xs"
                              >
                                <span>{farm.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="pt-3.5 border-t border-neutral-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(user)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 active:scale-98 text-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => setConfirmToggleUser(user)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                        }`}
                        title={isActive ? 'Inactivar usuario' : 'Activar usuario'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{isActive ? 'Inactivar' : 'Activar'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* BOTÓN FLOTANTE (FAB) PARA REGISTRAR NUEVO USUARIO                         */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={handleOpenCreate}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 bg-[#1B4820] hover:bg-[#123316] p-4 rounded-full text-white shadow-2xl transform transition-transform duration-300 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shadow-[#1B4820]/40"
        title="Registrar nuevo usuario"
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </button>

      {/* Modal de Creación / Edición de Usuario */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        user={selectedUserToEdit}
        onSaved={(savedUser) => {
          showToast(
            selectedUserToEdit
              ? `Usuario ${savedUser.name} actualizado con éxito.`
              : `Usuario ${savedUser.name} registrado con éxito.`
          );
        }}
      />

      {/* Modal de Confirmación para Inactivar / Reactivar */}
      <AnimatePresence>
        {confirmToggleUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmToggleUser(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-neutral-200 z-10 space-y-4"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                confirmToggleUser.status === 'Activo'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                <Power className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-neutral-900">
                  {confirmToggleUser.status === 'Activo' ? '¿Inactivar Usuario?' : '¿Activar Usuario?'}
                </h3>
                <p className="text-xs text-neutral-500 font-medium">
                  {confirmToggleUser.status === 'Activo'
                    ? `El usuario ${confirmToggleUser.name} no podrá iniciar sesión en la aplicación ni sincronizar datos hasta que sea reactivado.`
                    : `El usuario ${confirmToggleUser.name} recuperará el acceso a la aplicación con sus permisos correspondientes.`}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmToggleUser(null)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(confirmToggleUser)}
                  className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black text-white transition-all cursor-pointer shadow-md ${
                    confirmToggleUser.status === 'Activo'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  }`}
                >
                  {confirmToggleUser.status === 'Activo' ? 'Sí, Inactivar' : 'Sí, Activar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Drawer de Navegación */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        farmsCount={rawFarms.length}
        onOpenFarms={() => setIsFarmModalOpen(true)}
        potrerosCount={rawPotreros.length}
        onOpenPotreros={() => setIsPotreroModalOpen(true)}
        ownersCount={rawOwners.length}
        onOpenOwners={() => setIsOwnerModalOpen(true)}
        onForceResync={handleForceSync}
        isResyncing={isResyncing}
        resyncSuccess={resyncSuccess}
        onLogout={handleLogoutFlow}
      />

      {/* Modales de Gestión del Menú */}
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
    </div>
  );
}
