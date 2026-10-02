// Donos de uma empresa: membros com role owner + donos vinculados (tenant_owners).
// Usado por /api/empresa/donos (dono) e /api/admin/empresas/[id]/donos (superadmin).
import type { createAdminClient } from '@/lib/supabase-admin'
import { buscarUsuarioPorEmail, convidarUsuario, normalizarEmail } from '@/lib/convite'
import { resumoAuth } from '@/lib/auth-resumo'

type Admin = ReturnType<typeof createAdminClient>
type Resultado = { status: number; body: Record<string, unknown> }

export type Dono = {
  user_id: string
  full_name: string | null
  email: string | null
  origem: 'empresa' | 'vinculado'
  is_active: boolean
}

// Exceções das funções do banco → resposta legível
const ERROS: Record<string, [number, string]> = {
  'ultimo dono': [409, 'A empresa precisa de pelo menos 1 dono ativo'],
  'ja e dono': [409, 'Usuário já é dono desta empresa'],
  'usuario de outra empresa nao e dono': [409, 'Usuário pertence a outra empresa e não é dono lá'],
  'dono de outras empresas': [409, 'Este dono também é dono de outras empresas; remova esses vínculos antes'],
  'nao e dono': [404, 'Usuário não é dono desta empresa'],
  'usuario invalido': [400, 'Usuário inválido ou inativo'],
  'superadmin nao vira dono': [400, 'Superadmin não pode ser dono'],
  'empresa inexistente': [404, 'Empresa não encontrada'],
}

function erroDb(message: string | undefined, fallback: string): Resultado {
  const conhecido = message ? ERROS[message] : undefined
  if (conhecido) return { status: conhecido[0], body: { error: conhecido[1] } }
  console.error('[donos]', fallback, message)
  return { status: 500, body: { error: fallback } }
}

// funções fora dos tipos gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (admin: Admin, fn: string, args: Record<string, unknown>) => (admin.rpc as any)(fn, args) as
  Promise<{ data: unknown; error: { message: string } | null }>

export async function listarDonos(admin: Admin, tenantId: string): Promise<Dono[]> {
  const [{ data: membros, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
    admin.from('user_profiles').select('id, full_name, is_active').eq('tenant_id', tenantId).eq('role', 'owner'),
    admin.from('tenant_owners').select('user_id').eq('tenant_id', tenantId),
  ])
  if (e1 || e2) throw new Error('Erro ao buscar donos')

  const idsVinculados = (vinculos ?? []).map(v => v.user_id as string)
  const { data: perfisVinculados, error: e3 } = idsVinculados.length
    ? await admin.from('user_profiles').select('id, full_name, is_active').in('id', idsVinculados)
    : { data: [], error: null }
  if (e3) throw new Error('Erro ao buscar donos')

  const linhas = [
    ...(membros ?? []).map(p => ({ ...p, origem: 'empresa' as const })),
    ...(perfisVinculados ?? []).map(p => ({ ...p, origem: 'vinculado' as const })),
  ]
  const auth = await resumoAuth(admin, linhas.map(l => l.id as string))
  return linhas
    .map(l => ({
      user_id: l.id as string,
      full_name: (l.full_name as string | null) ?? null,
      email: auth.get(l.id as string)?.email ?? null,
      origem: l.origem,
      is_active: !!l.is_active,
    }))
    .sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '', 'pt-BR'))
}

// { user_id }: promove membro / vincula dono de outra empresa.
// { email, full_name? }: conta existente idem; conta nova (ou sem empresa) recebe convite como dono.
export async function adicionarDono(
  admin: Admin, tenantId: string, entrada: unknown, origin: string,
): Promise<Resultado> {
  const e = (entrada ?? {}) as { user_id?: unknown; email?: unknown; full_name?: unknown }

  let userId: string | null = typeof e.user_id === 'string' ? e.user_id : null
  if (!userId) {
    const email = normalizarEmail(e.email)
    if (!email) return { status: 400, body: { error: 'Email inválido' } }
    let usuario
    try {
      usuario = await buscarUsuarioPorEmail(admin, email)
    } catch {
      return { status: 500, body: { error: 'Erro ao buscar usuário' } }
    }
    const { data: perfil } = usuario
      ? await admin.from('user_profiles').select('tenant_id').eq('id', usuario.id).maybeSingle()
      : { data: null }

    if (!usuario || !perfil?.tenant_id) {
      // Conta nova ou sem empresa: convite como dono desta empresa
      const full_name = typeof e.full_name === 'string' ? e.full_name.trim() : ''
      if (!full_name) return { status: 400, body: { error: 'Informe o nome para convidar um novo dono' } }
      const r = await convidarUsuario({ admin, email, full_name, tenantId, role: 'owner', origin })
      if ('error' in r) return { status: r.status, body: { error: r.error } }
      return { status: 201, body: { user_id: r.id, resultado: 'convidado', convite_enviado: !r.reaproveitado || !!r.convite_enviado } }
    }
    userId = usuario.id
  }

  const { data, error } = await rpc(admin, 'adicionar_dono', { p_tenant: tenantId, p_user: userId })
  if (error) return erroDb(error.message, 'Erro ao adicionar dono')
  return { status: 201, body: { user_id: userId, resultado: data } }
}

export async function removerDono(admin: Admin, tenantId: string, userId: string): Promise<Resultado> {
  const { data, error } = await rpc(admin, 'remover_dono', { p_tenant: tenantId, p_user: userId })
  if (error) return erroDb(error.message, 'Erro ao remover dono')
  return { status: 200, body: { user_id: userId, resultado: data } }
}
