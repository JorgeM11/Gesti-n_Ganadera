import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  X, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  HardHat, 
  Building2, 
  Check, 
  Save, 
  AlertCircle,
  MapPin,
  CheckSquare,
  Square
} from 'lucide-react';
import { db } from '@/lib/db';
import { createUser, updateUser, getUserAssignedFarmIds } from '@/lib/userService';

export default function UserModal({
  isOpen,
  onClose,
  user = null,
  onSaved
}) {
  const isEditing = Boolean(user?.id);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('obrero'); // 'obrero' | 'operador'
  const [status, setStatus] = useState('Activo'); // 'Activo' | 'Inactivo'
  const [selectedFarmIds, setSelectedFarmIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fincas registradas en el sistema
  const allFarms = useLiveQuery(() => db.farms.filter(f => !f.deleted_at).toArray()) || [];

  // Inicializar estado cuando abre el modal
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setPassword('');
      setShowPassword(false);

      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
        setRole(user.role || 'obrero');
        setStatus(user.status || 'Activo');

        // Cargar fincas asignadas si es obrero
        if (user.role === 'obrero') {
          getUserAssignedFarmIds(user.id).then(farmIds => {
            setSelectedFarmIds(farmIds || []);
          }).catch(() => {
            setSelectedFarmIds([]);
          });
        } else {
          setSelectedFarmIds([]);
        }
      } else {
        setName('');
        setEmail('');
        setRole('obrero');
        setStatus('Activo');
        setSelectedFarmIds([]);
      }
    }
  }, [isOpen, user]);

  const toggleFarm = (farmId) => {
    setSelectedFarmIds(prev => 
      prev.includes(farmId) 
        ? prev.filter(id => id !== farmId)
        : [...prev, farmId]
    );
  };

  const selectAllFarms = () => {
    setSelectedFarmIds(allFarms.map(f => f.id));
  };

  const deselectAllFarms = () => {
    setSelectedFarmIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Por favor ingresa el nombre completo del usuario.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (!isEditing && (!password || password.trim().length < 6)) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (isEditing && password && password.trim().length < 6) {
      setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (role === 'obrero' && selectedFarmIds.length === 0) {
      setErrorMessage('Debes seleccionar al menos una finca asignada para el rol de Obrero.');
      return;
    }

    try {
      setIsSaving(true);

      if (isEditing) {
        const updated = await updateUser(user.id, {
          name,
          email,
          password: password.trim() || undefined,
          role,
          farmIds: role === 'obrero' ? selectedFarmIds : [],
          status
        });
        if (onSaved) onSaved(updated);
      } else {
        const created = await createUser({
          name,
          email,
          password: password.trim(),
          role,
          farmIds: role === 'obrero' ? selectedFarmIds : [],
          status
        });
        if (onSaved) onSaved(created);
      }

      onClose();
    } catch (err) {
      console.error('Error guardando usuario:', err);
      setErrorMessage(err.message || 'Error al guardar el usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 select-none overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[92vh] my-auto border border-neutral-200/80"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1B4820] text-white flex items-center justify-center shadow-md shadow-[#1B4820]/20">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 leading-tight">
                  {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <p className="text-xs text-neutral-400 font-medium">
                  {isEditing ? null : 'Registra un operador u obrero.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
            {/* Mensaje de error */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 font-bold animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Nombre Completo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider block">
                Nombre y Apellido *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Juan Carlos Pérez"
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 focus:border-[#1B4820] transition-all"
                />
              </div>
            </div>

            {/* 2. Correo Electrónico */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider block">
                Correo Electrónico *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@campo.com"
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 focus:border-[#1B4820] transition-all"
                />
              </div>
            </div>

            {/* 3. Contraseña */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider block">
                  Contraseña {isEditing ? '(Opcional)' : '*'}
                </label>
                {isEditing && (
                  null
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEditing ? '••••••••  (Sin cambios)' : 'Mínimo 6 caracteres'}
                  className="w-full pl-10 pr-11 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-900 outline-none focus:ring-2 focus:ring-[#1B4820]/20 focus:border-[#1B4820] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 4. Selector de Rol */}
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider block">
                Rol del Usuario *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opción OBRERO */}
                <button
                  type="button"
                  onClick={() => setRole('obrero')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative ${
                    role === 'obrero'
                      ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/20 shadow-xs'
                      : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                        <HardHat className="w-4 h-4" />
                      </div>
                      <span className="font-black text-sm text-neutral-900">Obrero</span>
                    </div>
                    {role === 'obrero' && <Check className="w-4 h-4 text-amber-700 stroke-[3]" />}
                  </div>
                  
                </button>

                {/* Opción OPERADOR */}
                <button
                  type="button"
                  onClick={() => setRole('operador')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative ${
                    role === 'operador'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 shadow-xs'
                      : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span className="font-black text-sm text-neutral-900">Operador</span>
                    </div>
                    {role === 'operador' && <Check className="w-4 h-4 text-blue-700 stroke-[3]" />}
                  </div>
                  
                </button>
              </div>
            </div>

            {/* 5. Asignación de Fincas (SOLO PARA OBRERO) */}
            {role === 'obrero' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2 border-t border-neutral-100"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-black text-amber-900 uppercase tracking-wider block">
                      Fincas Asignadas *
                    </label>
                    
                  </div>
                  {allFarms.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllFarms}
                        className="text-[11px] font-bold text-[#1B4820] hover:underline cursor-pointer"
                      >
                        Todas
                      </button>
                      <span className="text-neutral-300">•</span>
                      <button
                        type="button"
                        onClick={deselectAllFarms}
                        className="text-[11px] font-bold text-neutral-500 hover:underline cursor-pointer"
                      >
                        Ninguna
                      </button>
                    </div>
                  )}
                </div>

                {allFarms.length === 0 ? (
                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs text-amber-800">
                    No tienes fincas registradas aún. Ve al módulo de Fincas para registrar al menos una antes de crear obreros.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {allFarms.map((farm) => {
                      const isChecked = selectedFarmIds.includes(farm.id);
                      return (
                        <div
                          key={farm.id}
                          onClick={() => toggleFarm(farm.id)}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                            isChecked
                              ? 'border-[#1B4820] bg-emerald-50/70 text-[#1B4820] shadow-2xs'
                              : 'border-neutral-200 bg-neutral-50/60 text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Building2 className={`w-4 h-4 shrink-0 ${isChecked ? 'text-[#1B4820]' : 'text-neutral-400'}`} />
                            <div className="truncate">
                              <span className="truncate block">{farm.name}</span>
                              {farm.location && (
                                <span className="text-[10px] text-neutral-400 font-medium block truncate">
                                  {farm.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                            isChecked ? 'bg-[#1B4820] text-white' : 'border border-neutral-300 bg-white'
                          }`}>
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="text-right">
                  <span className="text-[11px] font-bold text-neutral-500">
                    {selectedFarmIds.length} {selectedFarmIds.length === 1 ? 'finca seleccionada' : 'fincas seleccionadas'}
                  </span>
                </div>
              </motion.div>
            )}

            {/* 6. Estado del Usuario (Activo / Inactivo) */}
            <div className="space-y-1.5 pt-1 border-t border-neutral-100">
              <label className="text-[11px] font-black text-neutral-700 uppercase tracking-wider block">
                Estado de la Cuenta
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatus('Activo')}
                  className={`py-3 px-4 rounded-2xl border-2 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    status === 'Activo'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${status === 'Activo' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                  <span>Activo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('Inactivo')}
                  className={`py-3 px-4 rounded-2xl border-2 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    status === 'Inactivo'
                      ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-2xs'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${status === 'Inactivo' ? 'bg-rose-500' : 'bg-neutral-400'}`} />
                  <span>Inactivo</span>
                </button>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="pt-3 border-t border-neutral-100 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:scale-98 text-neutral-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1B4820] hover:bg-[#123316] active:scale-98 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-[#1B4820]/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isEditing ? 'Guardar' : 'Registrar'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
