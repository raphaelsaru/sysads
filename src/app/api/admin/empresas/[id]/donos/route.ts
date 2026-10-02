import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { isUuid } from '@/lib/validacao'
import { buscarUsuarioPorEmail, normalizarEmail } from '@/lib/convite'
import { resumoAuth } from '@/lib/auth-resumo'

// Donos adicionais (tenant_owners): owner de outra empresa com acesso a esta. Só superadmin.
// Vínculo não consome slot; o dono troca de empresa pela EmpresaSwitcher.

type Params = { params: Promise<{ id: string }> }

// Retorna o id da empresa ou a resposta de erro.
async function autorizar(params: Params['params']): Promise<string | NextResponse> {
  const { id } = await params
  const caller = await getCaller()
  if (!caller || !isSuperadmin(caller.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  if (!isUuid(id)) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 })
  return id
}

// GET /api/admin/empresas/[id]/donos → { donos: [{ user_id, full_name, email, created_at }] }
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const id = await autorizar(params)
    if (typeof id !== 'string') return id
    const admin = createAdminClient()

    const { data: vinculos, error } = await admin.from('tenant_owners')
      .select('user_id, created_at').eq('tenant_id', id).order('created_at')
    if (error) return NextResponse.json({ error: 'Erro ao buscar donos' }, { status: 500 })
    if (!vinculos?.length) return NextResponse.json({ donos: [] })

    const ids = vinculos.map(v => v.user_id as string)
    const [{ data: perfis, error: perfisErro }, auth] = await Promise.all([
      admin.from('user_profiles').select('id, full_name').in('id', ids),
      resumoAuth(admin, ids),
    ])
    if (perfisErro) return NextResponse.json({ error: 'Erro ao buscar donos' }, { status: 500 })

    const nomes = new Map((perfis || []).map(p => [p.id as string, p.full_name as string | null]))
    const donos = vinculos.map((v) => ({
      user_id: v.user_id as string,
      full_name: nomes.get(v.user_id as string) ?? null,
      email: auth.get(v.user_id as string)?.email ?? null,
      created_at: v.created_at as string,
    }))
    return NextResponse.json({ donos })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/admin/empresas/[id]/donos { email } — vincula owner (ativo, de outra empresa).
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const id = await autorizar(params)
    if (typeof id !== 'string') return id
    const body = await request.json().catch(() => ({}))
    const email = normalizarEmail(body?.email)
    if (!email) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

    const admin = createAdminClient()
    const { data: tenant, error: tenantErro } = await admin
      .from('tenants').select('id').eq('id', id).maybeSingle()
    if (tenantErro) return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
    if (!tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    let usuario
    try {
      usuario = await buscarUsuarioPorEmail(admin, email)
    } catch {
      return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
    }
    if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const { data: perfil, error: perfilErro } = await admin.from('user_profiles')
      .select('role, is_active, tenant_id').eq('id', usuario.id).maybeSingle()
    if (perfilErro) return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
    if (!perfil || perfil.role !== 'owner' || !perfil.is_active || !perfil.tenant_id) {
      return NextResponse.json({ error: 'Usuário precisa ser dono ativo de outra empresa' }, { status: 400 })
    }
    if (perfil.tenant_id === id) {
      return NextResponse.json({ error: 'Usuário já é dono desta empresa' }, { status: 409 })
    }

    const { error } = await admin.from('tenant_owners')
      .insert({ tenant_id: id, user_id: usuario.id })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Já vinculado' }, { status: 409 })
      console.error('[admin/empresas/donos] insert falhou:', error.message)
      return NextResponse.json({ error: 'Erro ao vincular' }, { status: 500 })
    }
    return NextResponse.json({ user_id: usuario.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/admin/empresas/[id]/donos?user_id= — remove vínculo; tira o dono da empresa se estava nela.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const id = await autorizar(params)
    if (typeof id !== 'string') return id
    const userId = request.nextUrl.searchParams.get('user_id')
    if (!isUuid(userId)) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })

    const admin = createAdminClient()
    const { data: removidos, error } = await admin.from('tenant_owners')
      .delete().eq('tenant_id', id).eq('user_id', userId).select('user_id')
    if (error) return NextResponse.json({ error: 'Erro ao remover vínculo' }, { status: 500 })
    if (!removidos?.length) return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 })

    const { error: limparErro } = await admin.from('user_profiles')
      .update({ active_tenant_id: null }).eq('id', userId).eq('active_tenant_id', id)
    if (limparErro) {
      // Sem vínculo, effective_tenant_id já ignora active_tenant_id; só fica o valor órfão.
      console.error('[admin/empresas/donos] limpar active_tenant_id falhou:', limparErro.message)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
