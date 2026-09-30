import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { isUuid } from '@/lib/validacao'

// POST /api/admin/empresa-ativa { tenant_id: string | null } — superadmin troca empresa visitada.
// null (ou a própria empresa) = voltar à própria.
export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const tenantId: unknown = body?.tenant_id
    if (tenantId !== null && !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (tenantId !== null) {
      const { data: tenant, error } = await admin
        .from('tenants').select('id').eq('id', tenantId).maybeSingle()
      if (error) return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
      if (!tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const active_tenant_id = tenantId === caller.ownTenantId ? null : tenantId
    const { error } = await admin.from('user_profiles')
      .update({ active_tenant_id }).eq('id', caller.userId)
    if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
    return NextResponse.json({ active_tenant_id })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
