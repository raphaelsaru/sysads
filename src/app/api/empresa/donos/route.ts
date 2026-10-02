import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'
import { isUuid } from '@/lib/validacao'
import { adicionarDono, listarDonos, removerDono } from '@/lib/donos'

// Donos da empresa atual — dono (ou superadmin visitando) gerencia.
async function autorizar() {
  const caller = await getCaller()
  if (!caller?.tenantId || !canManageTeam(caller.role)) return null
  return { tenantId: caller.tenantId, admin: createAdminClient({ atorId: caller.userId }) }
}

const negado = () => NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

// GET → { donos }
export async function GET() {
  try {
    const ctx = await autorizar()
    if (!ctx) return negado()
    return NextResponse.json({ donos: await listarDonos(ctx.admin, ctx.tenantId) })
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar donos' }, { status: 500 })
  }
}

// POST { user_id } | { email, full_name? }
export async function POST(request: NextRequest) {
  try {
    const ctx = await autorizar()
    if (!ctx) return negado()
    const body = await request.json().catch(() => ({}))
    if (body?.user_id !== undefined && !isUuid(body.user_id)) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
    }
    const r = await adicionarDono(ctx.admin, ctx.tenantId, body, request.nextUrl.origin)
    return NextResponse.json(r.body, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE ?user_id=
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await autorizar()
    if (!ctx) return negado()
    const userId = request.nextUrl.searchParams.get('user_id')
    if (!isUuid(userId)) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
    const r = await removerDono(ctx.admin, ctx.tenantId, userId)
    return NextResponse.json(r.body, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
