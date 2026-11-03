import { db } from './db';
import { supabase } from './supabaseClient';
import { addToSyncQueue, runFullSync } from './syncUtils';
import { hashPassword, getCurrentUser } from './authService';

/**
 * Obtiene todos los usuarios visibles para el administrador actual
 */
export async function getTeamUsers() {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];

  // Los usuarios son: el mismo admin y todos los usuarios cuyo admin_id sea el admin actual
  const allUsers = await db.usuarios
    .filter(u => !u.deleted_at && (u.id === currentUser.id || u.admin_id === currentUser.id))
    .toArray();

  return allUsers;
}

/**
 * Obtiene las asignaciones de fincas para un usuario obrero
 * @param {string} userId 
 * @returns {Promise<string[]>} Array de farm_ids asignados
 */
export async function getUserAssignedFarmIds(userId) {
  if (!userId) return [];
  const assignments = await db.usuario_farms
    .where('user_id')
    .equals(userId)
    .filter(uf => !uf.deleted_at)
    .toArray();
  return assignments.map(uf => uf.farm_id);
}

/**
 * Crea un nuevo usuario en Dexie y encola para sincronizar con Supabase
 */
export async function createUser({ name, email, password, role, farmIds = [], status = 'Activo' }) {
  const currentUser = getCurrentUser();
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error('El nombre del usuario es obligatorio.');
  }

  if (!cleanEmail) {
    throw new Error('El correo electrónico es obligatorio.');
  }

  if (!password || password.trim().length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  if (!role || (role !== 'obrero' && role !== 'operador')) {
    throw new Error('El rol debe ser Obrero u Operador.');
  }

  if (role === 'obrero' && (!Array.isArray(farmIds) || farmIds.length === 0)) {
    throw new Error('Debes seleccionar al menos una finca para un usuario Obrero.');
  }

  // 1. Validar que el correo no esté registrado localmente
  const existingUser = await db.usuarios
    .where('email')
    .equalsIgnoreCase(cleanEmail)
    .filter(u => !u.deleted_at)
    .first();

  if (existingUser) {
    throw new Error(`El correo ${cleanEmail} ya se encuentra registrado.`);
  }

  // 2. Si hay conexión a internet, verificar también en Supabase
  if (navigator.onLine) {
    try {
      const { data: serverUsers } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('email', cleanEmail)
        .limit(1);

      if (serverUsers && serverUsers.length > 0) {
        throw new Error(`El correo ${cleanEmail} ya existe en el servidor.`);
      }
    } catch (err) {
      if (err.message.includes('ya existe')) throw err;
    }
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password.trim());
  const now = new Date().toISOString();
  const adminId = currentUser?.id || '00000000-0000-0000-0000-000000000001';

  const newUser = {
    id: userId,
    name: cleanName,
    email: cleanEmail,
    password_hash: passwordHash,
    role: role,
    admin_id: adminId,
    status: status || 'Activo',
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  // Guardar usuario en Dexie
  await db.usuarios.put(newUser);
  await addToSyncQueue('usuarios', 'INSERT', newUser);

  // Si es obrero, asignar fincas
  if (role === 'obrero' && Array.isArray(farmIds) && farmIds.length > 0) {
    for (const farmId of farmIds) {
      const newUf = {
        id: crypto.randomUUID(),
        user_id: userId,
        farm_id: farmId,
        created_at: now,
        updated_at: now,
        deleted_at: null
      };
      await db.usuario_farms.put(newUf);
      await addToSyncQueue('usuario_farms', 'INSERT', newUf);
    }
  }

  // Sincronizar en segundo plano si hay red
  if (navigator.onLine) {
    setTimeout(() => runFullSync(), 400);
  }

  return newUser;
}

/**
 * Actualiza un usuario existente
 */
export async function updateUser(userId, { name, email, password, role, farmIds = [], status }) {
  const existingUser = await db.usuarios.get(userId);
  if (!existingUser) {
    throw new Error('Usuario no encontrado.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const now = new Date().toISOString();

  if (!cleanName) {
    throw new Error('El nombre del usuario es obligatorio.');
  }

  if (!cleanEmail) {
    throw new Error('El correo electrónico es obligatorio.');
  }

  if (role === 'obrero' && (!Array.isArray(farmIds) || farmIds.length === 0)) {
    throw new Error('Debes seleccionar al menos una finca para un usuario Obrero.');
  }

  // Validar si el email cambió y si ya existe otro usuario con ese email
  if (cleanEmail !== existingUser.email?.toLowerCase()) {
    const duplicate = await db.usuarios
      .where('email')
      .equalsIgnoreCase(cleanEmail)
      .filter(u => u.id !== userId && !u.deleted_at)
      .first();

    if (duplicate) {
      throw new Error(`El correo ${cleanEmail} ya está en uso por otro usuario.`);
    }
  }

  let passwordHash = existingUser.password_hash;
  if (password && password.trim().length > 0) {
    if (password.trim().length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }
    passwordHash = await hashPassword(password.trim());
  }

  const updatedUser = {
    ...existingUser,
    name: cleanName,
    email: cleanEmail,
    password_hash: passwordHash,
    role: role || existingUser.role,
    status: status || existingUser.status || 'Activo',
    updated_at: now
  };

  await db.usuarios.put(updatedUser);
  await addToSyncQueue('usuarios', 'UPDATE', updatedUser);

  // Manejo de fincas asignadas
  if (role === 'obrero') {
    const currentAssignments = await db.usuario_farms
      .where('user_id')
      .equals(userId)
      .filter(uf => !uf.deleted_at)
      .toArray();

    const currentFarmIds = new Set(currentAssignments.map(a => a.farm_id));
    const targetFarmIds = new Set(farmIds);

    // 1. Agregar nuevas
    for (const targetId of farmIds) {
      if (!currentFarmIds.has(targetId)) {
        const newUf = {
          id: crypto.randomUUID(),
          user_id: userId,
          farm_id: targetId,
          created_at: now,
          updated_at: now,
          deleted_at: null
        };
        await db.usuario_farms.put(newUf);
        await addToSyncQueue('usuario_farms', 'INSERT', newUf);
      }
    }

    // 2. Remover desmarcadas
    for (const current of currentAssignments) {
      if (!targetFarmIds.has(current.farm_id)) {
        await db.usuario_farms.delete(current.id);
        await addToSyncQueue('usuario_farms', 'DELETE', { id: current.id, user_id: userId, farm_id: current.farm_id });
      }
    }
  } else if (role === 'operador') {
    // Si cambió a operador, eliminar cualquier asignación previa ya que operador tiene acceso global
    const previousAssignments = await db.usuario_farms
      .where('user_id')
      .equals(userId)
      .toArray();

    for (const assignment of previousAssignments) {
      await db.usuario_farms.delete(assignment.id);
      await addToSyncQueue('usuario_farms', 'DELETE', { id: assignment.id, user_id: userId, farm_id: assignment.farm_id });
    }
  }

  if (navigator.onLine) {
    setTimeout(() => runFullSync(), 400);
  }

  return updatedUser;
}

/**
 * Conmuta el estado de un usuario entre 'Activo' e 'Inactivo'
 */
export async function toggleUserStatus(userId) {
  const user = await db.usuarios.get(userId);
  if (!user) throw new Error('Usuario no encontrado.');

  const newStatus = user.status === 'Activo' ? 'Inactivo' : 'Activo';
  const now = new Date().toISOString();

  const updatedUser = {
    ...user,
    status: newStatus,
    updated_at: now
  };

  await db.usuarios.put(updatedUser);
  await addToSyncQueue('usuarios', 'UPDATE', updatedUser);

  if (navigator.onLine) {
    setTimeout(() => runFullSync(), 400);
  }

  return newStatus;
}
