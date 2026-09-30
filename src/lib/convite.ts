import type { createAdminClient } from '@/lib/supabase-admin'
import { mensagemErroDb } from '@/lib/tenant-server'
import type { UserRole } from '@/types/crm'

type AdminClient = ReturnType<typeof createAdminClient>

export type ResultadoConvite =
  | { id: string; reaproveitado: boolean }
  | { status: number; error: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizarEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const e = email.trim().toLowerCase()
  return EMAIL.test(e) ? e : null
}

// Admin API não tem busca por email; pagina listUsers (base pequena).
export async function buscarUsuarioPorEmail(admin: AdminClient, email: string) {
  const alvo = email.trim().toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return null
    const achado = data.users.find(u => u.email?.toLowerCase() === alvo)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
  return null
}

function emailJaCadastrado(err: { code?: string; status?: number; message?: string }) {
  return err.code === 'email_exists'
    || err.status === 422
    || !!err.message?.toLowerCase().includes('already')
}

// Convida (ou vincula conta existente sem empresa) p/ a empresa informada.
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

  // Pré-checagem de slots (trigger validar_slots também garante).
  const { count } = await admin.from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('is_active', true)
  if (tenant.max_users != null && (count ?? 0) >= tenant.max_users) {
    return { status: 409, error: 'Limite de usuários da empresa atingido' }
  }

  const { data: convite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/definir-senha`,
    data: { full_name, company_name: tenant.name },
  })

  if (inviteError || !convite.user) {
    if (!inviteError || !emailJaCadastrado(inviteError)) {
      return { status: 500, error: 'Erro ao enviar convite' }
    }

    // Conta já existe (ex.: antigo app financeiro). Reaproveita só se não tiver empresa.
    const existente = await buscarUsuarioPorEmail(admin, email)
    if (!existente) return { status: 409, error: 'Email já pertence a outra empresa' }
    const { data: perfil } = await admin.from('user_profiles')
      .select('tenant_id, role').eq('id', existente.id).maybeSingle()
    if (perfil?.tenant_id || perfil?.role === 'admin') {
      return { status: 409, error: 'Email já pertence a outra empresa' }
    }

    const { error } = await admin.from('user_profiles')
      .upsert({ id: existente.id, tenant_id: tenantId, role, full_name, is_active: true })
    if (error) return mensagemErroDb(error.message)
    return { id: existente.id, reaproveitado: true }
  }

  // handle_new_user criou o perfil sem empresa; vincula agora.
  const { error: perfilError } = await admin.from('user_profiles')
    .update({ tenant_id: tenantId, role, full_name, is_active: true })
    .eq('id', convite.user.id)
  if (perfilError) {
    await admin.auth.admin.deleteUser(convite.user.id)
    return mensagemErroDb(perfilError.message)
  }

  return { id: convite.user.id, reaproveitado: false }
}
