import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'
import { isUuid } from '@/lib/validacao'

type Admin = ReturnType<typeof createAdminClient>

// Vendedor alvo na empresa atual? Retorna resposta de erro ou null.
async function validarVendedor(admin: Admin, id: string, tenantId: string) {
  if (!isUuid(id)) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
  const { data: alvo, error } = await admin
    .from('user_profiles').select('tenant_id, role').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
  if (!alvo || alvo.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }
  if (alvo.role !== 'vendedor') {
    return NextResponse.json({ error: 'Usuário não é vendedor' }, { status: 400 })
  }
  return null
}

// GET — ids dos artistas que o vendedor atende.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const caller = await getCaller()
    if (!caller?.tenantId || !canManageTeam(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const admin = createAdminClient({ atorId: caller.userId })
    const invalido = await validarVendedor(admin, id, caller.tenantId)
    if (invalido) return invalido

    const { data, error } = await admin.from('vendedor_artistas')
      .select('artista_id').eq('vendedor_id', id).eq('tenant_id', caller.tenantId)
    if (error) return NextResponse.json({ error: 'Erro ao buscar artistas' }, { status: 500 })
    return NextResponse.json({ artistas: (data ?? []).map(r => r.artista_id) })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT { artistas: string[] } — substitui os artistas atendidos pelo vendedor.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const caller = await getCaller()
    if (!caller?.tenantId || !canManageTeam(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const tenantId = caller.tenantId
    const admin = createAdminClient({ atorId: caller.userId })
    const invalido = await validarVendedor(admin, id, tenantId)
    if (invalido) return invalido

    const body = await request.json().catch(() => ({}))
    const artistas: unknown = body?.artistas
    if (!Array.isArray(artistas) || !artistas.every(isUuid)) {
      return NextResponse.json({ error: 'artistas (lista de ids) é obrigatório' }, { status: 400 })
    }
    const ids = [...new Set(artistas)]

    // Todos precisam ser artistas da empresa atual
    if (ids.length > 0) {
      const { data: validos, error } = await admin.from('user_profiles')
        .select('id').in('id', ids).eq('tenant_id', tenantId).eq('role', 'user')
      if (error) return NextResponse.json({ error: 'Erro ao validar artistas' }, { status: 500 })
      if ((validos ?? []).length !== ids.length) {
        return NextResponse.json({ error: 'Artista inválido' }, { status: 400 })
      }
    }

    const { error: delError } = await admin.from('vendedor_artistas')
      .delete().eq('vendedor_id', id).eq('tenant_id', tenantId)
    if (delError) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
    if (ids.length > 0) {
      const { error: insError } = await admin.from('vendedor_artistas')
        .insert(ids.map(artista_id => ({ tenant_id: tenantId, vendedor_id: id, artista_id })))
      if (insError) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
    }
    return NextResponse.json({ artistas: ids })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
