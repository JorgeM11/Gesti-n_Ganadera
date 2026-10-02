import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Terra Form] Faltan las variables de entorno de Supabase. ' +
    'Asegúrate de que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén en tu archivo .env'
  );
}

/**
 * Custom Fetch con Timeout diferenciado:
 * 60 segundos para Storage (subida/descarga de fotos pesadas)
 * y 15 segundos para consultas API estándar.
 * Evita el "agujero negro" de 2 minutos cuando el Service Worker 
 * o una red inestable secuestran la petición, sin cortar subidas de imágenes.
 */
const fetchWithTimeout = async (url, options) => {
  const urlStr = typeof url === 'string' ? url : (url?.url || '');
  const isStorage = urlStr.includes('/storage/v1/');
  const timeoutMs = isStorage ? 60000 : 15000;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error; // Falla rápido para que la app sepa que está offline
  }
};

/**
 * Cliente Supabase singleton — configurado para PWA Offline-First
 *
 * persistSession: true     -> Guarda el Refresh Token en localStorage
 * autoRefreshToken: true    -> Renueva silenciosamente el JWT cuando hay internet
 * detectSessionInUrl: false -> No necesario para login con email/password
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout, // Inyectamos nuestro candado de 3 segundos
  }
});