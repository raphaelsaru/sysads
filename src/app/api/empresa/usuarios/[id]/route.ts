import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, mensagemErroDb } from '@/lib/tenant-server'
import { canManageTeam, isSuperadmin } from '@/lib/roles'

// PATCH { is_active } — owner/superadmin ativa/desativa usuário da empresa atual.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const caller = await getCaller()
    if (!caller?.tenantId || !canManageTeam(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (id === caller.userId) {
      return NextResponse.json({ error: 'Você não pode desativar a si mesmo' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const is_active: unknown = body?.is_active
    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active (boolean) é obrigatório' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: alvo } = await admin
      .from('user_profiles').select('tenant_id, role').eq('id', id).maybeSingle()
    if (!alvo || alvo.tenant_id !== caller.tenantId || alvo.role === 'admin') {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }
    // Dono não mexe em outro dono; só superadmin.
    if (alvo.role === 'owner' && !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Apenas o superadmin pode alterar outro dono' }, { status: 403 })
    }

    const { error } = await admin
      .from('user_profiles').update({ is_active })
      .eq('id', id).eq('tenant_id', caller.tenantId)
    if (error) {
      const { status, error: msg } = mensagemErroDb(error.message)
      return NextResponse.json({ error: msg }, { status })
    }
    return NextResponse.json({ id, is_active })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
