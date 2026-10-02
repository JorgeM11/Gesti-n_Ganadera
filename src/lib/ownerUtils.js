import { db } from './db';
import { addToSyncQueue } from './syncUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Obtiene todos los dueños activos
 */
export async function getOwners() {
  const userId = localStorage.getItem('ganadera_user_id');
  if (!userId) return [];

  return db.owners
    .filter(o => !o.deleted_at)
    .toArray();
}

/**
 * Crea un nuevo dueño (solo nombre según requerimiento)
 */
export async function createOwner({ name }) {
  const userId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';

  if (!name?.trim()) throw new Error('El nombre del dueño es obligatorio');

  const now = new Date().toISOString();
  const newOwner = {
    id: uuidv4(),
    user_id: userId,
    name: name.trim(),
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  await db.owners.put(newOwner);
  await addToSyncQueue('owners', 'INSERT', newOwner);
  return newOwner;
}

/**
 * Actualiza el nombre de un dueño
 */
export async function updateOwner(id, { name }) {
  const now = new Date().toISOString();
  const owner = await db.owners.get(id);
  if (!owner) throw new Error('Dueño no encontrado');

  const updatedOwner = {
    ...owner,
    name: name !== undefined ? name.trim() : owner.name,
    updated_at: now
  };

  await db.owners.put(updatedOwner);
  await addToSyncQueue('owners', 'UPDATE', updatedOwner);
  return updatedOwner;
}

/**
 * Elimina lógicamente un dueño
 */
export async function deleteOwner(id) {
  const now = new Date().toISOString();
  const owner = await db.owners.get(id);
  if (!owner) return;

  const deletedOwner = {
    ...owner,
    deleted_at: now,
    updated_at: now
  };

  await db.owners.put(deletedOwner);
  await addToSyncQueue('owners', 'UPDATE', deletedOwner);
}
