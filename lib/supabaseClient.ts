import { createClient } from '@supabase/supabase-js';

/**
 * Sanitiza y valida la URL base de Supabase:
 * - Elimina espacios y comillas accidentales
 * - Elimina sufijos como '/rest/v1' o '/rest/v1/' que causan el error PGRST125 ("Invalid path specified in request URL")
 * - Elimina cualquier barra diagonal ('/') sobrante al final
 */
function sanitizeSupabaseUrl(url?: string): string {
  if (!url || typeof url !== 'string') {
    return 'https://kqpelwznftifxwudldhu.supabase.co';
  }
  let cleaned = url.trim().replace(/^["']|["']$/g, '');
  // Remueve cualquier sufijo /rest/v1 o /rest/v1/
  cleaned = cleaned.replace(/\/rest\/v1\/?.*$/i, '');
  // Remueve barras diagonales al final
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned || 'https://kqpelwznftifxwudldhu.supabase.co';
}

/**
 * Sanitiza y valida la clave pública anónima de Supabase
 */
function sanitizeSupabaseKey(key?: string): string {
  if (!key || typeof key !== 'string') {
    return 'sb_publishable_EmykuH7keSxE2V6AFMrYCw_Am4mALV6';
  }
  const cleaned = key.trim().replace(/^["']|["']$/g, '');
  return cleaned || 'sb_publishable_EmykuH7keSxE2V6AFMrYCw_Am4mALV6';
}

const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = sanitizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
  },
});