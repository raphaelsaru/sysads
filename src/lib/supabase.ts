import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Verifica se as variáveis de ambiente estão definidas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas!')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseAnonKey)
  throw new Error('Configuração do Supabase inválida')
}

// Singleton pattern para evitar múltiplas instâncias do GoTrueClient
let supabaseInstance: SupabaseClient | null = null

// Função para criar cliente com timeout personalizado
export const createSupabaseClient = (timeoutMs: number = 30000): SupabaseClient => {
  try {
    // Se já existe uma instância, reutiliza ela para evitar múltiplos GoTrueClients
    if (supabaseInstance && typeof window !== 'undefined') {
      console.log('🔄 Reutilizando instância existente do Supabase client')
      return supabaseInstance
    }

    console.log('🆕 Criando nova instância do Supabase client com timeout:', timeoutMs)
    console.log('🔗 URL:', supabaseUrl)
    console.log('🔑 Key exists:', !!supabaseAnonKey)
    
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'X-Client-Info': 'prizely-crm',
        },
        // Configuração de timeout global
        fetch: (url, options = {}) => {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
          
          return fetch(url, {
            ...options,
            signal: controller.signal,
          }).finally(() => {
            clearTimeout(timeoutId)
          })
        },
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      db: {
        schema: 'public',
      },
    })

    // Armazena a instância apenas no lado do cliente
    if (typeof window !== 'undefined') {
      supabaseInstance = client
    }

    console.log('✅ Cliente Supabase criado com sucesso')
    return client
  } catch (error) {
    console.error('❌ Erro ao criar cliente Supabase:', error)
    throw error
  }
}

// Cliente principal com timeout de 30 segundos
let supabase: SupabaseClient

try {
  supabase = createSupabaseClient(30000)
} catch (error) {
  console.error('❌ Falha crítica ao inicializar cliente Supabase:', error)
  // Cria um cliente de fallback para evitar crash da aplicação
  supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    { auth: { persistSession: false } }
  )
}

// Exporta o cliente principal
export { supabase }

// Função para limpar a instância (útil para testes ou logout)
export const clearSupabaseInstance = () => {
  if (typeof window !== 'undefined') {
    supabaseInstance = null
  }
}

export default supabase