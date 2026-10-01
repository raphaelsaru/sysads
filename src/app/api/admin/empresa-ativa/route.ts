import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { isUuid } from '@/lib/validacao'

// POST /api/admin/empresa-ativa { tenant_id: string | null } — troca a empresa ativa.
// Superadmin: qualquer empresa (visita). Owner: só a própria ou vinculadas em tenant_owners.
// null (ou a própria empresa) = voltar à própria.
export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller()
    const superadmin = !!caller && isSuperadmin(caller.role)
    if (!caller || (!superadmin && caller.role !== 'owner')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const tenantId: unknown = body?.tenant_id
    if (tenantId !== null && !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!superadmin && tenantId !== null && tenantId !== caller.ownTenantId) {
      const { data: vinculo, error } = await admin.from('tenant_owners').select('tenant_id')
        .eq('user_id', caller.userId).eq('tenant_id', tenantId).maybeSingle()
      if (error) return NextResponse.json({ error: 'Erro ao verificar acesso' }, { status: 500 })
      if (!vinculo) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (tenantId !== null) {
      const { data: tenant, error } = await admin
        .from('tenants').select('id, is_active').eq('id', tenantId).maybeSingle()
      if (error) return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
      if (!tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
      // Só superadmin visita empresa inativa
      if (!superadmin && !tenant.is_active) {
        return NextResponse.json({ error: 'Empresa inativa' }, { status: 409 })
      }
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
