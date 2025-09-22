import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configurações para melhor conectividade global
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Timeout mais longo para usuários de outros países
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    // Headers para melhor conectividade
    headers: {
      'X-Client-Info': 'prizely-crm',
    },
  },
  // Configurações de retry para conectividade global
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export default supabase