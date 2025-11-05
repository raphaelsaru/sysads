import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase Admin usando SERVICE_ROLE_KEY
 * ATENÇÃO: Este cliente bypassa RLS e deve ser usado apenas em APIs server-side
 * NUNCA exponha a SERVICE_ROLE_KEY no cliente (browser)
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada nas variáveis de ambiente')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

