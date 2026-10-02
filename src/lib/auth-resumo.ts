import type { createAdminClient } from '@/lib/supabase-admin'

export type ResumoAuth = { email: string | null; last_sign_in_at: string | null; currency: string | null }

// Email/último login/moeda de vários usuários numa consulta (RPC só service role).
export async function resumoAuth(
  admin: ReturnType<typeof createAdminClient>, ids: string[],
): Promise<Map<string, ResumoAuth>> {
  if (ids.length === 0) return new Map()
  // função fora dos tipos gerados
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.rpc as any)('auth_resumo_usuarios', { p_ids: ids })
  if (error) throw new Error(`auth_resumo_usuarios: ${error.message}`)
  return new Map(((data ?? []) as ({ id: string } & ResumoAuth)[]).map(({ id, ...r }) => [id, r]))
}
