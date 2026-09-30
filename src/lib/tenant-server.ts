import { createClient } from '@/lib/supabase-server'
import type { UserRole } from '@/types/crm'

export type Caller = {
  userId: string
  role: UserRole
  tenantId: string | null   // empresa efetiva (visitada, p/ superadmin)
  ownTenantId: string | null
}

export async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: tenantId }] = await Promise.all([
    supabase.from('user_profiles').select('role, tenant_id, is_active').eq('id', user.id).single(),
    supabase.rpc('current_tenant_id'),
  ])
  if (!profile || !profile.is_active) return null

  return {
    userId: user.id,
    role: profile.role as UserRole,
    tenantId: (tenantId as string | null) ?? null,
    ownTenantId: profile.tenant_id,
  }
}

// Erros de trigger (slots) viram 409 com mensagem legível.
export function mensagemErroDb(message?: string): { status: number; error: string } {
  if (message?.includes('limite de usuarios')) return { status: 409, error: 'Limite de usuários da empresa atingido' }
  if (message?.includes('slots menor')) return { status: 409, error: 'Slots menor que o número de usuários ativos' }
  return { status: 500, error: 'Erro ao salvar' }
}
