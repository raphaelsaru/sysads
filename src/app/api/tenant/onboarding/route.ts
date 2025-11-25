import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { OnboardingData } from '@/types/crm'

/**
 * GET /api/tenant/onboarding
 * Verificar status do onboarding do tenant
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar perfil do usuário e tenant
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ 
        completed: false,
        message: 'Usuário não está associado a um tenant' 
      })
    }

    // Buscar dados do tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_completed, onboarding_completed_at')
      .eq('id', profile.tenant_id)
      .single()

    return NextResponse.json({
      completed: tenant?.onboarding_completed || false,
      completed_at: tenant?.onboarding_completed_at || null
    })
  } catch (error) {
    console.error('Erro ao verificar onboarding:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/tenant/onboarding
 * Completar wizard de onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: 'Usuário não está associado a um tenant' }, { status: 400 })
    }

    // Apenas tenant_admin ou admin_global podem completar onboarding
    if (profile.role !== 'tenant_admin' && profile.role !== 'admin_global') {
      return NextResponse.json({ error: 'Apenas admins podem completar o onboarding' }, { status: 403 })
    }

    // Parse do body
    const body = await request.json() as OnboardingData

    // Validação
    if (!body.companyName || !body.primaryColor || !body.secondaryColor) {
      return NextResponse.json({ 
        error: 'Nome da empresa, cor primária e secundária são obrigatórios' 
      }, { status: 400 })
    }

    // Atualizar tenant com dados do onboarding
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update({
        branding: {
          companyName: body.companyName,
          primaryColor: body.primaryColor,
          secondaryColor: body.secondaryColor,
          logo: body.logo || null
        },
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', profile.tenant_id)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao atualizar tenant:', updateError)
      return NextResponse.json({ error: 'Erro ao completar onboarding' }, { status: 500 })
    }

    console.log('✅ Onboarding completado para tenant:', updatedTenant.name)
    return NextResponse.json({ 
      success: true,
      tenant: updatedTenant 
    })
  } catch (error) {
    console.error('Erro ao completar onboarding:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}







