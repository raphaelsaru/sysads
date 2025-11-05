import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

type GenericDatabase = Record<string, unknown>
type BrowserClient = SupabaseClient<GenericDatabase>

let client: BrowserClient | null = null

export function createClient(): BrowserClient {
  if (client) {
    return client
  }

  console.log('🔧 Criando cliente Supabase')

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as BrowserClient

  return client
}
