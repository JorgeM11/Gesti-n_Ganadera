import { db } from './db';
import { supabase } from './supabaseClient';
import { runFullSync } from './syncUtils';

/**
 * Función de hashing SHA-256 nativa de Web Crypto (compatible offline y PWA)
 */
export async function hashPassword(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Inicializa un usuario Administrador por defecto si la base de datos está vacía.
 */
export async function seedInitialAdminIfNeeded() {
  const defaultAdminEmail = 'admin@campo.com';
  const defaultAdminPass = 'admin123';
  const passHash = await hashPassword(defaultAdminPass);

  // 1. Asegurar SIEMPRE el admin en Dexie local para acceso inmediato
  let localUser = await db.usuarios.where('email').equalsIgnoreCase(defaultAdminEmail).first();
  if (!localUser) {
    const newAdmin = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Administrador Principal',
      email: defaultAdminEmail,
      password_hash: passHash,
      role: 'admin',
      status: 'Activo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await db.usuarios.put(newAdmin);
    localUser = newAdmin;
    console.log('[Auth] Admin local asegurado en Dexie.');
  }

  // 2. Si hay conexión, verificar y reflejar en Supabase
  if (navigator.onLine) {
    try {
      const { data: serverUsers, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', defaultAdminEmail)
        .limit(1);

      if (!error && (!serverUsers || serverUsers.length === 0)) {
        await supabase
          .from('usuarios')
          .insert({
            id: localUser.id,
            name: localUser.name,
            email: defaultAdminEmail,
            password_hash: passHash,
            role: 'admin',
            status: 'Activo'
          });
      }
    } catch (e) {
      console.warn('[Auth] Intento de sincronizar admin con Supabase:', e.message);
    }
  }
}

/**
 * Inicia sesión validando contra Supabase (si hay internet) o Dexie local (si está offline).
 * No depende de Supabase Auth JWT, evitando la caducidad y expulsión del usuario en campo.
 */
export async function authenticateUser(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const passHash = await hashPassword(password);

  // 1. Validar conexión a internet: Requerida obligatoriamente para iniciar sesión
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      message: 'No tienes conexión a internet. Se requiere conexión activa para iniciar sesión.'
    };
  }

  // 2. Validar con Supabase en la nube
  try {
    const { data: users, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', cleanEmail)
      .limit(1);

    if (error) {
      return {
        success: false,
        message: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.'
      };
    }

    if (!users || users.length === 0) {
      return {
        success: false,
        message: 'Correo o contraseña incorrectos.'
      };
    }

    const user = users[0];

    // Validar status
    if (user.status !== 'Activo') {
      return {
        success: false,
        message: `Acceso denegado. Tu cuenta se encuentra en estado: ${user.status}.`
      };
    }

    // Validar contraseña
    if (user.password_hash === passHash) {
      // Guardar en Dexie local para acceso continuo una vez autenticado
      await db.usuarios.put(user);
      saveSessionLocally(user);

      // Si es obrero, sincronizar inmediatamente sus asignaciones de fincas vigentes desde Supabase
      if (user.role === 'obrero') {
        try {
          const { data: serverUfs } = await supabase
            .from('usuario_farms')
            .select('*')
            .eq('user_id', user.id);

          if (serverUfs) {
            const existingUfs = await db.usuario_farms.where('user_id').equals(user.id).toArray();
            if (existingUfs.length > 0) {
              await db.usuario_farms.bulkDelete(existingUfs.map(u => u.id));
            }
            if (serverUfs.length > 0) {
              await db.usuario_farms.bulkPut(serverUfs);
            }
          }
        } catch (ufErr) {
          console.warn('[Auth] Error al precargar asignaciones del obrero al login:', ufErr);
        }
      }

      // Disparar sincronización de fondo
      setTimeout(() => runFullSync(), 500);
      return { success: true, user };
    } else {
      return { success: false, message: 'Correo o contraseña incorrectos.' };
    }
  } catch (netErr) {
    return {
      success: false,
      message: 'Error de red con el servidor. Se requiere internet para iniciar sesión.'
    };
  }
}

/**
 * Guarda las credenciales locales de sesión (permanentes sin expiración arbitraria)
 */
export function saveSessionLocally(user) {
  const previousUserId = localStorage.getItem('ganadera_user_id');
  if (previousUserId !== user.id) {
    // Si cambia de usuario, asegurar una sincronización limpia desde el inicio
    localStorage.removeItem('lastSyncTimestamp');
  }

  localStorage.setItem('ganadera_user_id', user.id);
  localStorage.setItem('ganadera_user_name', user.name || '');
  localStorage.setItem('ganadera_user_email', user.email || '');
  localStorage.setItem('ganadera_user_role', user.role || 'operador');
  if (user.admin_id) {
    localStorage.setItem('ganadera_admin_id', user.admin_id);
  } else {
    localStorage.removeItem('ganadera_admin_id');
  }
}

/**
 * Obtiene los datos del usuario logueado en sesión
 */
export function getCurrentUser() {
  const id = localStorage.getItem('ganadera_user_id');
  if (!id) return null;
  const role = localStorage.getItem('ganadera_user_role') || 'admin';
  const adminId = localStorage.getItem('ganadera_admin_id') || null;
  const isWorker = role === 'obrero';
  const isOperator = role === 'operador';
  const isAdmin = role === 'admin';
  return {
    id,
    name: localStorage.getItem('ganadera_user_name') || '',
    email: localStorage.getItem('ganadera_user_email') || '',
    role,
    adminId,
    isWorker,
    isOperator,
    isAdmin,
    effectiveAdminId: (isWorker || isOperator) && adminId ? adminId : id
  };
}

/**
 * Retorna true si el usuario activo tiene rol de obrero
 */
export function isCurrentUserWorker() {
  const user = getCurrentUser();
  return Boolean(user?.isWorker);
}

/**
 * Retorna true si el usuario activo tiene rol de operador
 */
export function isCurrentUserOperator() {
  const user = getCurrentUser();
  return Boolean(user?.isOperator);
}

/**
 * Retorna true si el usuario activo es administrador titular
 */
export function isCurrentUserAdmin() {
  const user = getCurrentUser();
  return Boolean(user?.isAdmin || (!user?.isWorker && !user?.isOperator));
}

/**
 * Retorna el ID de titular de datos: admin_id si es obrero, o su propio id si es admin
 */
export function getEffectiveUserId() {
  const user = getCurrentUser();
  return user?.effectiveAdminId || localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';
}

/**
 * Cierra la sesión activa
 */
export function logoutUser() {
  localStorage.removeItem('ganadera_user_id');
  localStorage.removeItem('ganadera_user_name');
  localStorage.removeItem('ganadera_user_email');
  localStorage.removeItem('ganadera_user_role');
  localStorage.removeItem('ganadera_admin_id');
  localStorage.removeItem('lastSyncTimestamp');
}
