import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'

// POST — reenvia convite p/ usuário da empresa atual que ainda não entrou.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const caller = await getCaller()
    if (!caller?.tenantId || !canManageTeam(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: alvo } = await admin
      .from('user_profiles').select('tenant_id, role, full_name, is_active').eq('id', id).maybeSingle()
    if (!alvo || alvo.tenant_id !== caller.tenantId || alvo.role === 'admin') {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }
    if (!alvo.is_active) {
      return NextResponse.json({ error: 'Usuário desativado' }, { status: 409 })
    }

    const { data: auth } = await admin.auth.admin.getUserById(id)
    if (!auth.user?.email) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    if (auth.user.last_sign_in_at) {
      return NextResponse.json({ error: 'Usuário já aceitou o convite' }, { status: 409 })
    }

    const { data: tenant } = await admin.from('tenants').select('name').eq('id', caller.tenantId).single()
    // GoTrue reenvia convite enquanto o usuário não confirmou o email.
    const { error } = await admin.auth.admin.inviteUserByEmail(auth.user.email, {
      redirectTo: `${request.nextUrl.origin}/auth/definir-senha`,
      data: { full_name: alvo.full_name, company_name: tenant?.name },
    })
    if (error) {
      const jaConfirmado = error.code === 'email_exists' || error.status === 422
        || error.message?.toLowerCase().includes('already')
      return jaConfirmado
        ? NextResponse.json({ error: 'Usuário já aceitou o convite' }, { status: 409 })
        : NextResponse.json({ error: 'Erro ao reenviar convite' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
