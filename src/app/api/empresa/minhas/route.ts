import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'

// GET /api/empresa/minhas — empresas do dono: [primária, ...vinculadas (tenant_owners)].
// Outros papéis → { empresas: [] } (superadmin usa /api/admin/empresas).
export async function GET() {
  try {
    const caller = await getCaller()
    if (!caller) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    if (caller.role !== 'owner' || !caller.ownTenantId) return NextResponse.json({ empresas: [] })

    const admin = createAdminClient()
    const { data: vinculos, error } = await admin.from('tenant_owners')
      .select('tenant_id').eq('user_id', caller.userId)
    if (error) return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 })

    const ids = [caller.ownTenantId, ...(vinculos || []).map(v => v.tenant_id as string)
      .filter(id => id !== caller.ownTenantId)]
    const { data: tenants, error: tenantsErro } = await admin.from('tenants')
      .select('id, name, is_active').in('id', ids)
    if (tenantsErro) return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 })

    const primaria = (tenants || []).filter(t => t.id === caller.ownTenantId)
    const vinculadas = (tenants || []).filter(t => t.id !== caller.ownTenantId)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'))
    return NextResponse.json({ empresas: [...primaria, ...vinculadas] })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
