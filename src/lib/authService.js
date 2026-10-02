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
  localStorage.setItem('ganadera_user_id', user.id);
  localStorage.setItem('ganadera_user_name', user.name || '');
  localStorage.setItem('ganadera_user_email', user.email || '');
  localStorage.setItem('ganadera_user_role', user.role || 'operador');
}

/**
 * Obtiene los datos del usuario logueado en sesión
 */
export function getCurrentUser() {
  const id = localStorage.getItem('ganadera_user_id');
  if (!id) return null;
  return {
    id,
    name: localStorage.getItem('ganadera_user_name') || '',
    email: localStorage.getItem('ganadera_user_email') || '',
    role: localStorage.getItem('ganadera_user_role') || 'operador',
  };
}

/**
 * Cierra la sesión activa
 */
export function logoutUser() {
  localStorage.removeItem('ganadera_user_id');
  localStorage.removeItem('ganadera_user_name');
  localStorage.removeItem('ganadera_user_email');
  localStorage.removeItem('ganadera_user_role');
}
