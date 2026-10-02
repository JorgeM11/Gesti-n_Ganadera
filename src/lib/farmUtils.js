import { db } from './db';
import { addToSyncQueue } from './syncUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Obtiene todas las fincas activas del usuario
 */
export async function getFarms() {
  const userId = localStorage.getItem('ganadera_user_id');
  if (!userId) return [];

  return db.farms
    .where('user_id')
    .equals(userId)
    .and(f => !f.deleted_at)
    .toArray();
}

/**
 * Crea una nueva finca en Dexie y la encola para sincronizar con Supabase
 */
export async function createFarm({ name, location = '', description = '' }) {
  const userId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';

  const now = new Date().toISOString();
  const newFarm = {
    id: uuidv4(),
    user_id: userId,
    name: name.trim(),
    location: location?.trim() || null,
    description: description?.trim() || null,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  await db.farms.put(newFarm);
  await addToSyncQueue('farms', 'INSERT', newFarm);
  return newFarm;
}

/**
 * Actualiza los datos de una finca existente
 */
export async function updateFarm(id, { name, location, description }) {
  const now = new Date().toISOString();
  const farm = await db.farms.get(id);
  if (!farm) throw new Error('Finca no encontrada');

  const updatedFarm = {
    ...farm,
    name: name !== undefined ? name.trim() : farm.name,
    location: location !== undefined ? location?.trim() : farm.location,
    description: description !== undefined ? description?.trim() : farm.description,
    updated_at: now
  };

  await db.farms.put(updatedFarm);
  await addToSyncQueue('farms', 'UPDATE', updatedFarm);
  return updatedFarm;
}

/**
 * Elimina lógicamente una finca
 */
export async function deleteFarm(id) {
  const now = new Date().toISOString();
  const farm = await db.farms.get(id);
  if (!farm) return;

  const deletedFarm = {
    ...farm,
    deleted_at: now,
    updated_at: now
  };

  await db.farms.put(deletedFarm);
  await addToSyncQueue('farms', 'UPDATE', deletedFarm);
}
