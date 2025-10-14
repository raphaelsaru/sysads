import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

export function createClient() {
  if (client) {
    return client
  }

  console.log('🔧 Criando cliente Supabase Browser com configurações otimizadas')

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Garantir persistência de sessão
        persistSession: true,
        // Detectar sessão na URL (útil para redirecionamentos de auth)
        detectSessionInUrl: true,
        // Auto-refresh de tokens
        autoRefreshToken: true,
        // Flow de autenticação
        flowType: 'pkce',
        // Configurações de storage customizadas
        storage: {
          getItem: (key: string) => {
            if (typeof window === 'undefined') return null
            // Tentar cookies primeiro, depois localStorage
            const cookieValue = getCookie(key)
            if (cookieValue) {
              console.log('🍪 Sessão recuperada do cookie:', key)
              return cookieValue
            }
            const localValue = localStorage.getItem(key)
            if (localValue) {
              console.log('💾 Sessão recuperada do localStorage:', key)
            }
            return localValue
          },
          setItem: (key: string, value: string) => {
            if (typeof window === 'undefined') return
            console.log('💾 Salvando sessão:', key)
            // Salvar em ambos para máxima compatibilidade
            localStorage.setItem(key, value)
            setCookie(key, value, 365) // 1 ano
          },
          removeItem: (key: string) => {
            if (typeof window === 'undefined') return
            console.log('🗑️ Removendo sessão:', key)
            localStorage.removeItem(key)
            deleteCookie(key)
          },
        },
      },
      global: {
        headers: {
          'X-Client-Info': 'prizely-web',
        },
      },
    }
  )

  return client
}

// Funções auxiliares para manipular cookies
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift()
    return cookieValue ? decodeURIComponent(cookieValue) : null
  }
  return null
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax;Secure`
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}
