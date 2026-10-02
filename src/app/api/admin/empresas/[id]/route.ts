import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, mensagemErroDb } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { isMaxUsersValido, isUuid, MAX_USERS_LIMITE, NOME_EMPRESA_MAX } from '@/lib/validacao'

// PATCH /api/admin/empresas/[id] { name?, max_users?, is_active?, owner_id? } — superadmin.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const caller = await getCaller()
    if (!caller || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (!isUuid(id)) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const campos: { name?: string; max_users?: number; is_active?: boolean } = {}

    if (body?.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name || name.length > NOME_EMPRESA_MAX) {
        return NextResponse.json({ error: `Nome deve ter de 1 a ${NOME_EMPRESA_MAX} caracteres` }, { status: 400 })
      }
      campos.name = name
    }
    if (body?.max_users !== undefined) {
      if (!isMaxUsersValido(body.max_users)) {
        return NextResponse.json({ error: `Slots deve ser um inteiro entre 1 e ${MAX_USERS_LIMITE}` }, { status: 400 })
      }
      campos.max_users = body.max_users
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
      if (!isUuid(body.owner_id)) return NextResponse.json({ error: 'Dono inválido' }, { status: 400 })
      ownerId = body.owner_id
    }
    if (!Object.keys(campos).length && !ownerId) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const admin = createAdminClient({ atorId: caller.userId })
    const { data: tenant, error: buscaErro } = await admin
      .from('tenants').select('id').eq('id', id).maybeSingle()
    if (buscaErro) return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
    if (!tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    // Troca de dono primeiro, atômica no banco (promove + rebaixa demais owners; nunca o superadmin).
    // Estado parcial restante: dono trocado mas update de campos falha (ex.: slots < ativos) —
    // a resposta é o erro dos campos; a troca de dono permanece aplicada.
    if (ownerId) {
      const { error } = await admin.rpc('definir_dono', { p_tenant: id, p_user: ownerId })
      if (error) {
        if (error.message?.includes('dono invalido')) {
          return NextResponse.json({ error: 'Dono deve ser usuário ativo da empresa' }, { status: 400 })
        }
        if (error.message?.includes('empresa inexistente')) {
          return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
        }
        console.error('[admin/empresas] definir_dono falhou:', error.message)
        return NextResponse.json({ error: 'Erro ao definir dono' }, { status: 500 })
      }
    }

    if (Object.keys(campos).length) {
      const { error } = await admin.from('tenants').update(campos).eq('id', id)
      if (error) {
        const { status, error: msg } = mensagemErroDb(error.message)
        return NextResponse.json({ error: msg }, { status })
      }
    }

    const { data: empresa, error: lerErro } = await admin.from('tenants')
      .select('id, name, slug, max_users, is_active, created_at').eq('id', id).single()
    if (lerErro || !empresa) return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
    return NextResponse.json({ empresa, owner_id: ownerId ?? undefined })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
