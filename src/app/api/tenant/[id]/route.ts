import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/tenant/[id]
 * Obter dados do tenant (usado pelo TenantContext)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Verificar se o usuário tem acesso a este tenant
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    // Super admin tem acesso a todos os tenants
    // Outros usuários só ao próprio tenant
    if (profile?.role !== 'admin_global' && profile?.tenant_id !== id) {
      return NextResponse.json({ error: 'Acesso negado ao tenant' }, { status: 403 })
    }

    return NextResponse.json({ tenant })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}







