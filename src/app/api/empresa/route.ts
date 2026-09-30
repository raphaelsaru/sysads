import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'

const HEX = /^#[0-9a-fA-F]{6}$/

// GET /api/empresa — dados da empresa atual (qualquer usuário ativo dela).
export async function GET() {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, max_users, is_active, branding')
      .eq('id', caller.tenantId)
      .single()
    if (error || !tenant) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ tenant })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH /api/empresa { primaryColor: '#RRGGBB' | null } — owner/superadmin.
export async function PATCH(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !canManageTeam(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const primaryColor: unknown = body?.primaryColor
    if (primaryColor !== null && (typeof primaryColor !== 'string' || !HEX.test(primaryColor))) {
      return NextResponse.json({ error: 'Cor inválida (use #RRGGBB)' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: atual, error: buscaError } = await admin
      .from('tenants').select('branding').eq('id', caller.tenantId).single()
    if (buscaError || !atual) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const branding = {
      ...((atual.branding as Record<string, unknown> | null) ?? {}),
      primaryColor: primaryColor === null ? null : primaryColor.toLowerCase(),
    }
    const { error } = await admin.from('tenants').update({ branding }).eq('id', caller.tenantId)
    if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
    return NextResponse.json({ branding })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
