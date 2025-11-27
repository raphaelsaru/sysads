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

    // Buscar tenant - usar select explícito para garantir que settings seja retornado
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, description, max_clients, max_users, is_active, branding, settings, metadata, created_at, updated_at, onboarding_completed, onboarding_completed_at')
      .eq('id', id)
      .single()

    if (tenantError || !tenant) {
      console.error('❌ Erro ao buscar tenant:', tenantError)
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Garantir que settings existe e é um objeto válido
    // Se settings vier vazio, tentar buscar novamente usando RPC ou query direta
    if (!tenant.settings || (typeof tenant.settings === 'object' && Object.keys(tenant.settings).length === 0)) {
      console.log('⚠️ Settings vazio, tentando buscar novamente...')
      
      // Tentar buscar settings usando uma query mais específica
      const { data: settingsData, error: settingsError } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', id)
        .single()
      
      if (!settingsError && settingsData?.settings) {
        console.log('✅ Settings encontrado na segunda tentativa:', settingsData.settings)
        tenant.settings = settingsData.settings
      } else {
        console.log('⚠️ Settings ainda vazio após segunda tentativa')
        // Manter o settings vazio, mas garantir que seja um objeto
        tenant.settings = tenant.settings || {}
      }
    }

    // Log para debug
    console.log('📋 Tenant carregado na API:', {
      id: tenant.id,
      name: tenant.name,
      settings: tenant.settings,
      settingsType: typeof tenant.settings,
      settingsIsObject: tenant.settings instanceof Object,
      settingsKeys: Object.keys(tenant.settings || {}),
      ocr_instagram_enabled: tenant.settings?.ocr_instagram_enabled,
      settingsStringified: JSON.stringify(tenant.settings),
    })

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







