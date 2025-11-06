import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { CreateTenantInput } from '@/types/crm'

/**
 * GET /api/admin/tenants
 * Lista todos os tenants (apenas super admin)
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas super admin' }, { status: 403 })
    }

    // Buscar todos os tenants com estatísticas
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenant_statistics')
      .select('*')
      .order('created_at', { ascending: false })

    if (tenantsError) {
      console.error('Erro ao buscar tenants:', tenantsError)
      return NextResponse.json({ error: 'Erro ao buscar tenants' }, { status: 500 })
    }

    return NextResponse.json({ tenants: tenants || [] })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/admin/tenants
 * Cria um novo tenant (apenas super admin)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas super admin' }, { status: 403 })
    }

    // Parse do body
    const body = await request.json() as CreateTenantInput

    // Validação
    if (!body.name || !body.slug) {
      return NextResponse.json({ error: 'Nome e slug são obrigatórios' }, { status: 400 })
    }

    // Verificar se slug já existe
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', body.slug)
      .single()

    if (existingTenant) {
      return NextResponse.json({ error: 'Slug já está em uso' }, { status: 400 })
    }

    // Criar tenant
    const { data: newTenant, error: createError } = await supabase
      .from('tenants')
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description || null,
        max_clients: body.max_clients || 1000,
        max_users: body.max_users || 10,
        is_active: true,
        onboarding_completed: false,
        branding: {
          logo: body.branding?.logo || null,
          companyName: body.branding?.companyName || body.name,
          primaryColor: body.branding?.primaryColor || '#3b82f6',
          secondaryColor: body.branding?.secondaryColor || '#8b5cf6',
        },
        settings: {},
        metadata: {}
      })
      .select()
      .single()

    if (createError) {
      console.error('Erro ao criar tenant:', createError)
      return NextResponse.json({ error: 'Erro ao criar tenant' }, { status: 500 })
    }

    console.log('✅ Tenant criado:', newTenant.name)
    return NextResponse.json({ tenant: newTenant }, { status: 201 })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}



