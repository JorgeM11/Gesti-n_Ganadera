import { db } from './db';
import { addToSyncQueue } from './syncUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Obtiene todos los potreros activos de una finca (o todos si no se pasa farmId)
 */
export async function getPotreros(farmId = null) {
  const userId = localStorage.getItem('ganadera_user_id');
  if (!userId) return [];

  let collection = db.potreros.filter(p => !p.deleted_at);
  if (farmId) {
    collection = collection.filter(p => p.farm_id === farmId);
  }
  return collection.toArray();
}

/**
 * Crea un nuevo potrero asociado a una finca
 */
export async function createPotrero({ farm_id, name }) {
  const userId = localStorage.getItem('ganadera_user_id') || '00000000-0000-0000-0000-000000000001';

  if (!farm_id) throw new Error('Se requiere especificar la finca para el potrero');
  if (!name?.trim()) throw new Error('El nombre del potrero es obligatorio');

  const now = new Date().toISOString();
  const newPotrero = {
    id: uuidv4(),
    user_id: userId,
    farm_id,
    name: name.trim(),
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  await db.potreros.put(newPotrero);
  await addToSyncQueue('potreros', 'INSERT', newPotrero);
  return newPotrero;
}

/**
 * Actualiza el nombre o datos de un potrero
 */
export async function updatePotrero(id, { name, farm_id }) {
  const now = new Date().toISOString();
  const potrero = await db.potreros.get(id);
  if (!potrero) throw new Error('Potrero no encontrado');

  const updatedPotrero = {
    ...potrero,
    name: name !== undefined ? name.trim() : potrero.name,
    farm_id: farm_id !== undefined ? farm_id : potrero.farm_id,
    updated_at: now
  };

  await db.potreros.put(updatedPotrero);
  await addToSyncQueue('potreros', 'UPDATE', updatedPotrero);
  return updatedPotrero;
}

/**
 * Elimina lógicamente un potrero
 */
export async function deletePotrero(id) {
  const now = new Date().toISOString();
  const potrero = await db.potreros.get(id);
  if (!potrero) return;

  const deletedPotrero = {
    ...potrero,
    deleted_at: now,
    updated_at: now
  };

  await db.potreros.put(deletedPotrero);
  await addToSyncQueue('potreros', 'UPDATE', deletedPotrero);
}
