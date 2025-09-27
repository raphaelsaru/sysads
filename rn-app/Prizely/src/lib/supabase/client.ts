import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import { getEnv } from '@lib/env'

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
      storage: AsyncStorage,
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
    const keys = await AsyncStorage.getAllKeys()
    const authKeys = keys.filter((key) => key.includes('supabase') || key.includes('auth'))
    if (authKeys.length) {
      await AsyncStorage.multiRemove(authKeys)
    }
  } catch (error) {
    console.warn('Erro ao limpar armazenamento Supabase', error)
  }
}
