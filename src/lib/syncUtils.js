import { db } from './db';
import { supabase } from './supabaseClient';
import { useSyncStore } from '@/store/syncStore';
import { uploadImageToSupabase } from './imageUtils';
import { logoutUser } from './authService';

let isSyncing = false;

// Helper para timeout en promesas
const withTimeout = (promise, ms = 8000) => {
  const timeout = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('TIMEOUT_EXCEEDED'));
    }, ms);
  });
  return Promise.race([promise, timeout]);
};

/**
 * 1. PUSH: De local a la Nube.
 */
export async function processSyncQueue() {
  const pendingItems = await db.sync_queue
    .where('status')
    .anyOf(['PENDING', 'ERROR'])
    .sortBy('created_at');

  if (pendingItems.length === 0) return;

  const store = useSyncStore.getState();
  store.setPendingItemsCount(pendingItems.length);

  for (const item of pendingItems) {
    try {
      const payloadToUpload = { ...item.payload };

      // --- SIEMPRE eliminar photo_blob antes de enviar a la nube ---
      delete payloadToUpload.photo_blob;

      // --- IMÁGENES: subir blob local si aún no tiene URL remota ---
      if (item.payload.photo_blob && !payloadToUpload.photo_path) {
        const fileName = `offline-sync-${item.table_name}-${payloadToUpload.id}`;
        const url = await withTimeout(
          uploadImageToSupabase(item.payload.photo_blob, fileName),
          45000 // 45s de gracia para subida de imagen en redes lentas
        );
        payloadToUpload.photo_path = url;
        // Guardamos photo_path en Dexie manteniendo el photo_blob intacto
        await db.table(item.table_name).update(payloadToUpload.id, { photo_path: url });
        // También actualizamos en el payload local por si la subida a BD fallara luego
        item.payload.photo_path = url;
      }

      // --- SUBIDA A BASE DE DATOS ---
      let error;
      if (item.operation === 'PATCH' || (item.operation === 'UPDATE' && !payloadToUpload.user_id)) {
        // UPDATE parcial (ej. soft-delete { id, deleted_at } o campos específicos):
        // Usar HTTP PATCH (update) para evitar que PostgREST valide NOT NULL en columnas ausentes
        const { id, ...fields } = payloadToUpload;
        if (id) {
          const { error: patchError } = await withTimeout(
            supabase.from(item.table_name).update(fields).eq('id', id),
            15000 // 15s de gracia
          );
          error = patchError;
        } else {
          console.warn(`[Sync Engine] Operación PATCH/UPDATE en ${item.table_name} ignorada: no tiene id.`);
        }
      } else if (item.operation === 'INSERT') {
        const { error: upsertError } = await withTimeout(
          supabase.from(item.table_name).upsert(payloadToUpload),
          15000 // 15s de gracia
        );
        error = upsertError;
      } else if (item.operation === 'UPDATE') {
        // UPDATE con payload completo: intentar update por ID primero; si falla, upsert
        const { id, ...fields } = payloadToUpload;
        if (id) {
          const { error: updateError } = await withTimeout(
            supabase.from(item.table_name).update(fields).eq('id', id),
            15000
          );
          if (updateError) {
            const { error: upsertError } = await withTimeout(
              supabase.from(item.table_name).upsert(payloadToUpload),
              15000
            );
            error = upsertError;
          } else {
            error = updateError;
          }
        } else {
          const { error: upsertError } = await withTimeout(
            supabase.from(item.table_name).upsert(payloadToUpload),
            15000
          );
          error = upsertError;
        }
      } else if (item.operation === 'DELETE') {
        const { error: deleteError } = await withTimeout(
          supabase.from(item.table_name).delete().eq('id', item.payload.id),
          15000 // 15s de gracia
        );
        error = deleteError;
      }

      if (error) throw error;

      // Éxito: Eliminar de la cola local
      await db.sync_queue.delete(item.id);

      const currentCount = await db.sync_queue.where('status').anyOf(['PENDING', 'ERROR']).count();
      store.setPendingItemsCount(currentCount);

    } catch (err) {
      // FASE 4: CAPTURA INTELIGENTE DE ERRORES
      const errMsg = (err.message || '').toLowerCase();

      // Siempre lo devolvemos a PENDING (no a ERROR) para que la UI no se asuste
      await db.sync_queue.update(item.id, {
        status: 'PENDING',
        error_message: err.message || 'Error desconocido, se reintentará'
      });

      // Si el error es de sesión caducada (JWT), permisos (401), o falta de red real (fetch)
      // ABORTAMOS el bucle silenciosamente. No tiene sentido intentar subir los demás.
      if (errMsg.includes('timeout') || errMsg.includes('jwt') || errMsg.includes('auth') || errMsg.includes('fetch') || err.code === 'PGRST301' || err.status === 401) {
        console.warn('[Sync Engine] Timeout, sesión caducada o red inaccesible. Sincronización pausada silenciosamente.');
        break; // Rompe el ciclo for. El resto de items se quedan PENDING.
      }

      // Si es otro tipo de error (ej. dato mal formateado), continúa con el siguiente item
      continue;
    }
  }
}

/**
 * Descarga paginada de todos los IDs y estados deleted_at del servidor para una tabla
 */
async function fetchAllServerIds(table, userId) {
  let allRecords = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase.from(table).select('id, deleted_at').range(from, from + pageSize - 1);
    if (table !== 'usuarios') {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await withTimeout(query, 12000);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRecords.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRecords;
}

/**
 * 2. PULL: De Nube a Local (Offline-First, sin bloqueo por token JWT)
 */
export async function pullFromServer() {
  const userId = localStorage.getItem('ganadera_user_id');

  // Si no hay usuario autenticado en local, no descargamos
  if (!userId) {
    console.warn('[Sync Engine] PULL abortado: No hay usuario autenticado en local.');
    return;
  }

  const lastSync = localStorage.getItem('lastSyncTimestamp') || '1970-01-01T00:00:00Z';
  const currentSyncTime = new Date().toISOString();

  // Mapeamos los items pendientes en la cola local para protegerlos de eliminación durante la reconciliación
  const pendingQueue = await db.sync_queue.toArray();
  const pendingIdsByTable = new Map();
  for (const item of pendingQueue) {
    if (!pendingIdsByTable.has(item.table_name)) {
      pendingIdsByTable.set(item.table_name, new Set());
    }
    if (item.payload && item.payload.id) {
      pendingIdsByTable.get(item.table_name).add(item.payload.id);
    }
  }

  const tables = [
    'farms',
    'animals',
    'growth_events',
    'services',
    'pregnancy_checks',
    'health_records',
    'milking_records',
    'usuarios'
  ];

  for (const table of tables) {
    let query = supabase.from(table).select('*').gt('updated_at', lastSync);

    // Si la tabla maneja user_id, filtramos por el usuario activo (usuarios sincroniza directo)
    if (table !== 'usuarios') {
      query = query.eq('user_id', userId);
    }

    const { data: serverData, error } = await withTimeout(query, 12000);

    // Si la descarga falla (ej. pérdida súbita de señal), abortar
    if (error) {
      console.warn(`[Sync Engine] Error descargando ${table}:`, error.message);
      return;
    }

    if (serverData && serverData.length > 0) {
      // 1. Descarga de imágenes en paralelo y preservación estricta de blobs locales
      if (table === 'animals' || table === 'growth_events') {
        await Promise.allSettled(
          serverData.map(async (record) => {
            // A) Si ya tenemos el registro en Dexie localmente con su photo_blob físico, NUNCA sobreescribirlo con undefined
            const localRecord = await db.table(table).get(record.id);
            if (localRecord?.photo_blob) {
              record.photo_blob = localRecord.photo_blob;
            } else if (record.photo_path) {
              // B) Si es un registro nuevo o no tiene blob local, intentar descargarlo
              try {
                const response = await withTimeout(fetch(record.photo_path), 15000);
                if (response.ok) {
                  record.photo_blob = await response.blob();
                }
              } catch (imgErr) {
                // Silencioso: la imagen cargará por URL pública mientras haya red
              }
            }
          })
        );
      }

      // 2. Guardado en Dexie: 1 sola transacción en bloque sin pérdida de blobs
      await db.table(table).bulkPut(serverData);
    }

    // 3. RECONCILIACIÓN DE BORRADOS (Supabase -> Dexie)
    // Permite que eliminaciones directas en Supabase o panel administrativo se sincronicen en local
    if (table !== 'usuarios') {
      try {
        const serverIds = await fetchAllServerIds(table, userId);
        const serverMap = new Map(serverIds.map(r => [r.id, r]));
        const localRecords = await db.table(table).toArray();
        const pendingIds = pendingIdsByTable.get(table) || new Set();

        const toDeleteLocally = [];
        const toUpdateSoftDelete = [];

        for (const local of localRecords) {
          // Si el registro está en cola pendiente de subida local, protegerlo siempre
          if (pendingIds.has(local.id)) continue;

          if (!serverMap.has(local.id)) {
            // Borrado definitivo (Hard Delete) en Supabase: ya no existe en el servidor
            toDeleteLocally.push(local.id);
          } else {
            const serverRec = serverMap.get(local.id);
            // Borrado lógico (Soft Delete) en Supabase que aún no tenía deleted_at en local
            if (serverRec.deleted_at && !local.deleted_at) {
              toUpdateSoftDelete.push({
                ...local,
                deleted_at: serverRec.deleted_at
              });
            }
          }
        }

        if (toDeleteLocally.length > 0) {
          await db.table(table).bulkDelete(toDeleteLocally);
          console.log(`[Sync Engine] Reconciliación: eliminados ${toDeleteLocally.length} registros en local de ${table} borrados en el servidor.`);
        }

        if (toUpdateSoftDelete.length > 0) {
          await db.table(table).bulkPut(toUpdateSoftDelete);
          console.log(`[Sync Engine] Reconciliación: marcados como borrados ${toUpdateSoftDelete.length} registros en local de ${table}.`);
        }
      } catch (recError) {
        console.warn(`[Sync Engine] Advertencia durante la reconciliación de borrados de ${table}:`, recError.message);
      }
    }
  }
  localStorage.setItem('lastSyncTimestamp', currentSyncTime);
}

/**
 * Verifica si la cuenta del usuario fue deshabilitada o eliminada en el servidor.
 * En caso de haber sido deshabilitada:
 * 1. Actualiza el estado local en Dexie.
 * 2. Cierra la sesión activa.
 * 3. Redirige a /login con aviso de cuenta deshabilitada tras haber guardado los cambios.
 */
export async function verifyUserStatusAndHandleDisabled(userId) {
  if (!userId || !navigator.onLine) return false;

  try {
    const { data: serverUser, error } = await withTimeout(
      supabase
        .from('usuarios')
        .select('id, status, deleted_at')
        .eq('id', userId)
        .limit(1)
        .maybeSingle(),
      8000
    );

    if (!error && serverUser) {
      if (serverUser.status !== 'Activo' || serverUser.deleted_at) {
        console.warn('[Sync Engine] Cuenta deshabilitada en el servidor. Guardando cambios y cerrando sesión...');
        await db.usuarios.update(userId, { status: serverUser.status || 'Inactivo' });
        logoutUser();
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=account_disabled';
        }
        return true;
      }
    }
  } catch (err) {
    console.warn('[Sync Engine] Verificación de estado de usuario omitida:', err.message);
  }

  return false;
}

/**
 * 3. MASTER SYNC: El Orquestador. 
 */
export async function runFullSync() {
  const store = useSyncStore.getState();

  if (!navigator.onLine) {
    if (store.syncStatus !== 'IDLE') store.setSyncStatus('IDLE');
    return;
  }

  if (isSyncing || store.syncStatus === 'SYNCING') return;

  isSyncing = true;
  store.setSyncStatus('SYNCING');

  let hasErrors = false;

  // A) Guardar cambios locales pendientes hacia Supabase
  try {
    await processSyncQueue();
  } catch (err) {
    hasErrors = true;
  }

  // B) Verificar si la cuenta del usuario fue deshabilitada por el administrador
  const activeUserId = localStorage.getItem('ganadera_user_id');
  const wasDisabled = await verifyUserStatusAndHandleDisabled(activeUserId);
  if (wasDisabled) {
    store.setSyncStatus('IDLE');
    isSyncing = false;
    return;
  }

  try {
    await pullFromServer();
  } catch (err) {
    hasErrors = true;
  }

  try {
    const errorCount = await db.sync_queue.where('status').equals('ERROR').count();
    const pendingCount = await db.sync_queue.where('status').equals('PENDING').count();

    // Si quedaron items PENDING (porque pausamos por JWT expirado), no lo marcamos como error,
    // simplemente lo volvemos IDLE para que el usuario no vea advertencias rojas innecesarias.
    if (errorCount > 0 || hasErrors) {
      store.setSyncStatus('ERROR');
    } else if (pendingCount > 0) {
      store.setSyncStatus('IDLE');
    } else {
      store.setSyncStatus('UP_TO_DATE');
      setTimeout(() => {
        if (useSyncStore.getState().syncStatus === 'UP_TO_DATE') {
          useSyncStore.getState().setSyncStatus('IDLE');
        }
      }, 3000);
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Helper para agregar a la cola
 */
export async function addToSyncQueue(table_name, operation, payload) {
  await db.sync_queue.add({
    table_name,
    operation,
    payload,
    created_at: new Date().toISOString(),
    status: 'PENDING'
  });

  if (navigator.onLine) {
    setTimeout(() => {
      runFullSync();
    }, 1500);
  }
}

/**
 * FUERZA UNA DESCARGA TOTAL (El Botón de Pánico / Resincronización)
 * Ignora el historial local y descarga la base de datos completa de la nube.
 */
export async function forceFullResync() {
  const store = useSyncStore.getState();
  
  if (!navigator.onLine) {
    alert("Necesitas conexión a internet para realizar una sincronización completa.");
    return false;
  }

  try {
    store.setSyncStatus('SYNCING');
    console.log('[Sync Engine] Iniciando Resincronización Forzada...');
    
    // 0. Subir cambios locales pendientes primero para proteger datos no sincronizados
    try {
      await processSyncQueue();
    } catch (pushErr) {
      console.warn('[Sync Engine] Advertencia procesando cola antes del respaldo forzado:', pushErr.message);
    }

    // Verificar si la cuenta fue deshabilitada en el servidor tras respaldar cambios
    const activeUserId = localStorage.getItem('ganadera_user_id');
    const wasDisabled = await verifyUserStatusAndHandleDisabled(activeUserId);
    if (wasDisabled) {
      store.setSyncStatus('IDLE');
      return false;
    }

    // 1. Retrocedemos el reloj al inicio de los tiempos
    localStorage.setItem('lastSyncTimestamp', '1970-01-01T00:00:00Z');
    
    // 2. Ejecutamos el PULL puro (para traer todo y reconciliar borrados)
    await pullFromServer();
    
    store.setSyncStatus('UP_TO_DATE');
    setTimeout(() => {
      if (useSyncStore.getState().syncStatus === 'UP_TO_DATE') {
        useSyncStore.getState().setSyncStatus('IDLE');
      }
    }, 3000);
    
    return true; // Éxito
  } catch (error) {
    console.error('[Sync Engine] Error en la resincronización forzada:', error);
    store.setSyncStatus('ERROR');
    return false; // Fallo
  }
}