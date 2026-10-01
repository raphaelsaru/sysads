import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, mensagemErroDb } from '@/lib/tenant-server'
import { canManageTeam, isRoleConvidavel, isSuperadmin, type RoleConvidavel } from '@/lib/roles'

// PATCH { is_active?, role? } — owner/superadmin ativa/desativa ou troca papel de usuário da empresa atual.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const caller = await getCaller()
    if (!caller?.tenantId || !canManageTeam(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const is_active: unknown = body?.is_active
    const role: unknown = body?.role
    if (is_active === undefined && role === undefined) {
      return NextResponse.json({ error: 'Informe is_active ou role' }, { status: 400 })
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active deve ser boolean' }, { status: 400 })
    }
    if (role !== undefined && !isRoleConvidavel(role)) {
      return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
    }
    if (id === caller.userId) {
      return NextResponse.json({
        error: role !== undefined ? 'Você não pode alterar o próprio papel' : 'Você não pode desativar a si mesmo',
      }, { status: 400 })
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
    // Papel de dono não muda por aqui (nem pelo superadmin): usar definir_dono.
    if (alvo.role === 'owner' && role !== undefined) {
      return NextResponse.json({ error: 'O papel do dono não pode ser alterado aqui' }, { status: 403 })
    }

    const campos: { is_active?: boolean; role?: RoleConvidavel } = {}
    if (typeof is_active === 'boolean') campos.is_active = is_active
    if (isRoleConvidavel(role)) campos.role = role

    const { error } = await admin
      .from('user_profiles').update(campos)
      .eq('id', id).eq('tenant_id', caller.tenantId)
    if (error) {
      const { status, error: msg } = mensagemErroDb(error.message)
      return NextResponse.json({ error: msg }, { status })
    }
    return NextResponse.json({ id, ...campos })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
