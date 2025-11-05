import { createBrowserClient } from '@supabase/ssr'

type BrowserClient = ReturnType<typeof createBrowserClient>

let client: BrowserClient | null = null

export function createClient(): BrowserClient {
  if (client) {
    return client
  }

  console.log('🔧 Criando cliente Supabase')

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
