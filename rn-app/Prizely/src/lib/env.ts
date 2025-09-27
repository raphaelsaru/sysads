const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const getEnv = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missing = [
      !SUPABASE_URL ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
      !SUPABASE_ANON_KEY ? 'EXPO_PUBLIC_SUPABASE_ANON_KEY' : null,
    ].filter(Boolean)

    const message = `Variáveis de ambiente ausentes: ${missing.join(', ')}`
    throw new Error(message)
  }

  return {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  }
}
