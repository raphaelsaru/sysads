import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'
import { urlConvite } from '@/lib/convite'

// POST — reenvia convite p/ usuário da empresa atual que ainda não entrou.
// Se o convite já foi usado, manda link de redefinição de senha.
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
    const email = auth.user.email
    const origin = request.nextUrl.origin
    const enviarRecuperacao = async () => {
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: urlConvite(origin) })
      if (error) {
        console.error('[reenviar] resetPasswordForEmail falhou:', error.message)
        return NextResponse.json({ error: 'Erro ao enviar link de redefinição de senha' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, tipo: 'recuperacao' })
    }
    if (auth.user.last_sign_in_at) return enviarRecuperacao()

    const { data: tenant } = await admin.from('tenants').select('name').eq('id', caller.tenantId).single()
    // GoTrue reenvia convite enquanto o usuário não confirmou o email.
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: urlConvite(origin),
      data: { full_name: alvo.full_name, company_name: tenant?.name },
    })
    if (error) {
      // Email já confirmado: convite não serve mais, manda redefinição.
      if (error.code === 'email_exists') return enviarRecuperacao()
      return NextResponse.json({ error: 'Erro ao reenviar convite' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, tipo: 'convite' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
