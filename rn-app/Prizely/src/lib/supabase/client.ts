import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import { getEnv } from '@lib/env'

// Web storage adapter para evitar erro "window is not defined"
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: async (key: string) => {
        if (typeof window !== 'undefined') {
          return window.localStorage.getItem(key)
        }
        return null
      },
      setItem: async (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value)
        }
      },
      removeItem: async (key: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key)
        }
      },
    }
  }
  return AsyncStorage
}

const DEFAULT_TIMEOUT_MS = 30000

let supabaseClient: SupabaseClient | null = null

const createFetchWithTimeout = (timeoutMs: number) => {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const requestInit: RequestInit = {
        ...(init ?? {}),
        signal: controller.signal,
      }

      const response = await fetch(input as any, requestInit)
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export const createSupabaseClient = (timeoutMs: number = DEFAULT_TIMEOUT_MS): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient
  }

  const { supabaseUrl, supabaseAnonKey } = getEnv()

  const fetchWithTimeout = createFetchWithTimeout(timeoutMs)

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: getStorage(),
      storageKey: 'prizely-auth',
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithTimeout,
      headers: {
        'X-Client-Info': Platform.select({
          ios: 'prizely-mobile-ios',
          android: 'prizely-mobile-android',
          default: 'prizely-mobile',
        }),
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

  return supabaseClient
}

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient()
  }
  return supabaseClient
}

export const resetSupabaseClient = async () => {
  supabaseClient = null
  try {
    const storage = getStorage()

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // No web, limpar localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key))
    } else {
      // No mobile, usar AsyncStorage
      const keys = await AsyncStorage.getAllKeys()
      const authKeys = keys.filter((key) => key.includes('supabase') || key.includes('auth'))
      if (authKeys.length) {
        await AsyncStorage.multiRemove(authKeys)
      }
    }
  } catch (error) {
    console.warn('Erro ao limpar armazenamento Supabase', error)
  }
}
