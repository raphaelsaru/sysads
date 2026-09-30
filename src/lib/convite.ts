import type { User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase-admin'
import { mensagemErroDb } from '@/lib/tenant-server'
import type { UserRole } from '@/types/crm'

type AdminClient = ReturnType<typeof createAdminClient>

export type ResultadoConvite =
  | { id: string; reaproveitado: boolean }
  | { status: number; error: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INDISPONIVEL = { status: 409, error: 'Email indisponível para convite' }

export function normalizarEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const e = email.trim().toLowerCase()
  return EMAIL.test(e) ? e : null
}

// Base dos links de convite: NEXT_PUBLIC_SITE_URL; origin da request só se não configurada.
export function urlConvite(origin: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || origin
  return `${base}/auth/definir-senha`
}

// Admin API não tem busca por email; pagina listUsers (base pequena).
// Lança erro se a listagem falhar (não assume "não existe").
export async function buscarUsuarioPorEmail(admin: AdminClient, email: string): Promise<User | null> {
  const alvo = email.trim().toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error('[convite] listUsers falhou:', error.message)
      throw new Error('Falha ao buscar usuários')
    }
    const achado = data.users.find(u => u.email?.toLowerCase() === alvo)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
  return null
}

// Convida email novo ou vincula conta existente SEM empresa à empresa informada.
// Nunca move nem apaga conta (mesmo pendente) que já pertence a alguma empresa.
// Espera email já normalizado e full_name já com trim.
export async function convidarUsuario({ admin, email, full_name, tenantId, role, origin }: {
  admin: AdminClient
  email: string
  full_name: string
  tenantId: string
  role: Exclude<UserRole, 'admin'>
  origin: string
}): Promise<ResultadoConvite> {
  const { data: tenant } = await admin.from('tenants').select('name, max_users').eq('id', tenantId).single()
  if (!tenant) return { status: 404, error: 'Empresa não encontrada' }

  let existente: User | null
  try {
    existente = await buscarUsuarioPorEmail(admin, email)
  } catch {
    return { status: 500, error: 'Erro ao verificar email' }
  }

  if (existente) {
    const { data: perfil, error: perfilErro } = await admin.from('user_profiles')
      .select('tenant_id, role').eq('id', existente.id).maybeSingle()
    if (perfilErro) return { status: 500, error: 'Erro ao verificar email' }
    if (perfil?.tenant_id === tenantId) {
      return { status: 409, error: 'Usuário já faz parte da empresa' }
    }
    if (perfil?.role === 'admin' || perfil?.tenant_id) return INDISPONIVEL
  }

  // Pré-checagem de slots (trigger validar_slots também garante).
  const { count } = await admin.from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('is_active', true)
  if (tenant.max_users != null && (count ?? 0) >= tenant.max_users) {
    return { status: 409, error: 'Limite de usuários da empresa atingido' }
  }

  if (existente) {
    // Conta sem empresa (ex.: antigo app financeiro): vincula; entra com a senha atual.
    const { error } = await admin.from('user_profiles')
      .upsert({ id: existente.id, tenant_id: tenantId, role, full_name, is_active: true })
    if (error) return mensagemErroDb(error.message)
    return { id: existente.id, reaproveitado: true }
  }

  const { data: convite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: urlConvite(origin),
    data: { full_name, company_name: tenant.name },
  })
  if (inviteError || !convite.user) {
    // Corrida: conta criada entre a busca e o convite.
    if (inviteError?.code === 'email_exists') return INDISPONIVEL
    console.error('[convite] inviteUserByEmail falhou:', inviteError?.message)
    return { status: 500, error: 'Erro ao enviar convite' }
  }
  const novoId = convite.user.id

  // handle_new_user criou o perfil sem empresa; vincula (só se ainda sem empresa).
  const perfil = { tenant_id: tenantId, role, full_name, is_active: true }
  let { data: vinculados, error: perfilError } = await admin.from('user_profiles')
    .update(perfil).eq('id', novoId).is('tenant_id', null).select('id')
  if (!perfilError && !vinculados?.length) {
    ;({ data: vinculados, error: perfilError } = await admin.from('user_profiles')
      .upsert({ id: novoId, ...perfil }).select('id'))
  }
  if (perfilError || !vinculados?.length) {
    // Seguro: conta criada agora por este convite.
    await admin.auth.admin.deleteUser(novoId)
    return mensagemErroDb(perfilError?.message)
  }

  return { id: novoId, reaproveitado: false }
}
