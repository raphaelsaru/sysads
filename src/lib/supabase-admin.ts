import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase Admin usando SERVICE_ROLE_KEY
 * ATENÇÃO: Este cliente bypassa RLS e deve ser usado apenas em APIs server-side
 * NUNCA exponha a SERVICE_ROLE_KEY no cliente (browser)
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não está configurada nas variáveis de ambiente')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não está configurada nas variáveis de ambiente. ' +
      'Configure esta variável no seu ambiente de produção (Vercel, etc.) ' +
      'com a Service Role Key do seu projeto Supabase.'
    )
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

