import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, mensagemErroDb } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { convidarUsuario, normalizarEmail } from '@/lib/convite'

type AdminClient = ReturnType<typeof createAdminClient>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Rollback: só apaga a empresa recém-criada se nada a referencia.
// FKs de user_profiles/clientes/negociacoes/follow_ups são ON DELETE RESTRICT
// (antes CASCADE); checagem mantida como defesa. Na dúvida, não apaga.
// Erro no delete (ex.: FK) = não dá p/ desfazer: só loga; chamador devolve o erro original.
async function removerEmpresaVazia(admin: AdminClient, tenantId: string) {
  for (const tabela of ['user_profiles', 'clientes', 'negociacoes', 'follow_ups'] as const) {
    const { count, error } = await admin.from(tabela)
      .select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    if (error || count !== 0) {
      console.error(`[admin/empresas] rollback abortado (${tabela}):`, error?.message ?? count)
      return
    }
  }
  const { error } = await admin.from('tenants').delete().eq('id', tenantId)
  if (error) console.error('[admin/empresas] rollback falhou:', error.message)
}

// GET /api/admin/empresas — todas as empresas (superadmin).
export async function GET() {
  try {
    const caller = await getCaller()
    if (!caller || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const admin = createAdminClient()
    const [{ data: tenants, error: tErro }, { data: perfis, error: pErro }] = await Promise.all([
      admin.from('tenants').select('id, name, slug, max_users, is_active, created_at').order('name'),
      admin.from('user_profiles').select('id, full_name, role, tenant_id, is_active'),
    ])
    if (tErro || pErro) return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 })

    const empresas = (tenants ?? []).map(t => {
      const membros = (perfis ?? []).filter(p => p.tenant_id === t.id)
      return {
        ...t,
        ativos: membros.filter(m => m.is_active).length,
        donos: membros
          .filter(m => m.role === 'owner' || m.role === 'admin')
          .map(m => ({ id: m.id, full_name: m.full_name })),
      }
    })
    return NextResponse.json({ empresas })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/admin/empresas { name, max_users, dono: { user_id } | { email, full_name } }
export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const max_users: unknown = body?.max_users
    const dono = body?.dono
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    if (typeof max_users !== 'number' || !Number.isInteger(max_users) || max_users < 1) {
      return NextResponse.json({ error: 'Slots deve ser um inteiro ≥ 1' }, { status: 400 })
    }
    if (!dono || typeof dono !== 'object') {
      return NextResponse.json({ error: 'Dono é obrigatório' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Valida o dono ANTES de criar a empresa (evita rollback).
    let existente: { id: string; role: string; full_name: string | null } | null = null
    let novo: { email: string; full_name: string } | null = null
    if (dono.user_id !== undefined) {
      if (typeof dono.user_id !== 'string' || !UUID.test(dono.user_id)) {
        return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
      }
      const { data: perfil, error } = await admin.from('user_profiles')
        .select('id, role, full_name').eq('id', dono.user_id).maybeSingle()
      if (error) return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
      if (!perfil) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
      existente = perfil
    } else {
      const email = normalizarEmail(dono.email)
      const full_name = typeof dono.full_name === 'string' ? dono.full_name.trim() : ''
      if (!full_name || !dono.email) {
        return NextResponse.json({ error: 'Nome e email do dono são obrigatórios' }, { status: 400 })
      }
      if (!email) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
      novo = { email, full_name }
    }

    const slug = `${slugify(name) || 'empresa'}-${crypto.randomUUID().slice(0, 6)}`
    const { data: empresa, error: criarErro } = await admin.from('tenants')
      .insert({ name, slug, max_users, is_active: true, branding: {} })
      .select('id, name, slug, max_users, is_active, created_at').single()
    if (criarErro || !empresa) {
      console.error('[admin/empresas] criar empresa falhou:', criarErro?.message)
      return NextResponse.json({ error: 'Erro ao criar empresa' }, { status: 500 })
    }

    if (existente) {
      // Superadmin vira dono pela visita: perfil intacto.
      if (existente.role === 'admin') {
        return NextResponse.json({ empresa, dono: { id: existente.id, role: 'admin', reaproveitado: true } }, { status: 201 })
      }
      // Move o usuário p/ a nova empresa (leads antigos ficam na empresa anterior).
      const { data: movidos, error } = await admin.from('user_profiles')
        .update({ tenant_id: empresa.id, role: 'owner', is_active: true })
        .eq('id', existente.id).neq('role', 'admin').select('id')
      if (error || !movidos?.length) {
        await removerEmpresaVazia(admin, empresa.id)
        const { status, error: msg } = error
          ? mensagemErroDb(error.message)
          : { status: 409, error: 'Usuário indisponível' }
        return NextResponse.json({ error: msg }, { status })
      }
      return NextResponse.json({ empresa, dono: { id: existente.id, role: 'owner', reaproveitado: true } }, { status: 201 })
    }

    const r = await convidarUsuario({
      admin,
      email: novo!.email,
      full_name: novo!.full_name,
      tenantId: empresa.id,
      role: 'owner',
      origin: request.nextUrl.origin,
    })
    if ('error' in r) {
      await removerEmpresaVazia(admin, empresa.id)
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    return NextResponse.json({ empresa, dono: { ...r, role: 'owner' } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
