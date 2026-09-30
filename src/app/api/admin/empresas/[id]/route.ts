import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, mensagemErroDb } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH /api/admin/empresas/[id] { name?, max_users?, is_active?, owner_id? } — superadmin.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const caller = await getCaller()
    if (!caller || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (!UUID.test(id)) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const campos: { name?: string; max_users?: number; is_active?: boolean } = {}

    if (body?.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return NextResponse.json({ error: 'Nome inválido' }, { status: 400 })
      campos.name = name
    }
    if (body?.max_users !== undefined) {
      const m: unknown = body.max_users
      if (typeof m !== 'number' || !Number.isInteger(m) || m < 1) {
        return NextResponse.json({ error: 'Slots deve ser um inteiro ≥ 1' }, { status: 400 })
      }
      campos.max_users = m
    }
    if (body?.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json({ error: 'is_active deve ser boolean' }, { status: 400 })
      }
      if (!body.is_active && id === caller.ownTenantId) {
        return NextResponse.json({ error: 'Você não pode desativar sua própria empresa' }, { status: 400 })
      }
      campos.is_active = body.is_active
    }
    let ownerId: string | null = null
    if (body?.owner_id !== undefined) {
      if (typeof body.owner_id !== 'string' || !UUID.test(body.owner_id)) {
        return NextResponse.json({ error: 'Dono inválido' }, { status: 400 })
      }
      ownerId = body.owner_id
    }
    if (!Object.keys(campos).length && !ownerId) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: tenant, error: buscaErro } = await admin
      .from('tenants').select('id').eq('id', id).maybeSingle()
    if (buscaErro) return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
    if (!tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    // Valida o novo dono antes de qualquer escrita.
    if (ownerId) {
      const { data: alvo, error } = await admin.from('user_profiles')
        .select('tenant_id, role, is_active').eq('id', ownerId).maybeSingle()
      if (error) return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
      if (!alvo || alvo.tenant_id !== id || alvo.role === 'admin') {
        return NextResponse.json({ error: 'Usuário não pertence à empresa' }, { status: 400 })
      }
      if (!alvo.is_active) {
        return NextResponse.json({ error: 'Usuário inativo não pode ser dono' }, { status: 400 })
      }
    }

    if (Object.keys(campos).length) {
      const { error } = await admin.from('tenants').update(campos).eq('id', id)
      if (error) {
        const { status, error: msg } = mensagemErroDb(error.message)
        return NextResponse.json({ error: msg }, { status })
      }
    }

    if (ownerId) {
      // Promove primeiro: se falhar, os donos atuais continuam (empresa nunca fica sem dono).
      const { data: promovidos, error: promoverErro } = await admin.from('user_profiles')
        .update({ role: 'owner' })
        .eq('id', ownerId).eq('tenant_id', id).neq('role', 'admin').select('id')
      if (promoverErro || !promovidos?.length) {
        console.error('[admin/empresas] promover dono falhou:', promoverErro?.message)
        return NextResponse.json({ error: 'Erro ao definir dono' }, { status: 500 })
      }
      // Rebaixa os demais donos (nunca o superadmin).
      const { error: rebaixarErro } = await admin.from('user_profiles')
        .update({ role: 'user' })
        .eq('tenant_id', id).eq('role', 'owner').neq('id', ownerId)
      if (rebaixarErro) {
        console.error('[admin/empresas] rebaixar donos falhou:', rebaixarErro.message)
        return NextResponse.json({ error: 'Novo dono definido, mas falhou ao rebaixar os anteriores' }, { status: 500 })
      }
    }

    const { data: empresa } = await admin.from('tenants')
      .select('id, name, slug, max_users, is_active, created_at').eq('id', id).single()
    return NextResponse.json({ empresa, owner_id: ownerId ?? undefined })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
