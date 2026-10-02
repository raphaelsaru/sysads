import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { isUuid } from '@/lib/validacao'
import { adicionarDono, listarDonos, removerDono } from '@/lib/donos'

// Donos de qualquer empresa (membros owner + vinculados). Só superadmin.
// Mesmas regras de /api/empresa/donos (src/lib/donos.ts).

type Params = { params: Promise<{ id: string }> }

async function autorizar(params: Params['params']) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller || !isSuperadmin(caller.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  if (!isUuid(id)) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 })
  return { id, admin: createAdminClient({ atorId: caller.userId }) }
}

// GET → { donos }
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const ctx = await autorizar(params)
    if (ctx instanceof NextResponse) return ctx
    return NextResponse.json({ donos: await listarDonos(ctx.admin, ctx.id) })
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar donos' }, { status: 500 })
  }
}

// POST { user_id } | { email, full_name? }
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const ctx = await autorizar(params)
    if (ctx instanceof NextResponse) return ctx
    const body = await request.json().catch(() => ({}))
    if (body?.user_id !== undefined && !isUuid(body.user_id)) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
    }
    const r = await adicionarDono(ctx.admin, ctx.id, body, request.nextUrl.origin)
    return NextResponse.json(r.body, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE ?user_id=
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const ctx = await autorizar(params)
    if (ctx instanceof NextResponse) return ctx
    const userId = request.nextUrl.searchParams.get('user_id')
    if (!isUuid(userId)) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
    const r = await removerDono(ctx.admin, ctx.id, userId)
    return NextResponse.json(r.body, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
