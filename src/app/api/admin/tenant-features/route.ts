import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * PUT /api/admin/tenant-features
 * Atualiza as features habilitadas para um tenant específico
 * Apenas admin_global pode acessar
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é admin global
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    if (profile.role !== 'admin_global') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas admin global pode gerenciar features.' },
        { status: 403 }
      )
    }

    // Obter dados do request
    const body = await request.json()
    const { tenant_id, ocr_instagram_enabled } = body

    console.log('📥 Request recebido:', { tenant_id, ocr_instagram_enabled, body })

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id é obrigatório' },
        { status: 400 }
      )
    }

    if (typeof ocr_instagram_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'ocr_instagram_enabled deve ser um boolean' },
        { status: 400 }
      )
    }

    // Buscar tenant atual para manter outras settings
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenant_id)
      .single()

    if (fetchError || !tenant) {
      console.error('❌ Erro ao buscar tenant:', fetchError)
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 404 }
      )
    }

    console.log('📋 Tenant atual:', { 
      settings: tenant.settings,
      settingsType: typeof tenant.settings,
      settingsIsNull: tenant.settings === null,
    })

    // Atualizar settings do tenant
    // Garantir que sempre seja um objeto válido
    const currentSettings = tenant.settings && typeof tenant.settings === 'object' 
      ? tenant.settings 
      : {}
    
    const updatedSettings = {
      ...currentSettings,
      ocr_instagram_enabled: ocr_instagram_enabled,
    }

    console.log('🔄 Settings atualizadas:', {
      currentSettings,
      updatedSettings,
      updatedSettingsStringified: JSON.stringify(updatedSettings),
    })

    // Atualizar o tenant - garantir que o JSONB seja salvo corretamente
    // Usar uma abordagem explícita para garantir que funcione
    const updateData = {
      settings: updatedSettings as any, // Forçar tipo para garantir serialização
      updated_at: new Date().toISOString(),
    }

    console.log('📤 Dados para atualização:', {
      updateData,
      settingsType: typeof updateData.settings,
      settingsValue: updateData.settings,
      settingsStringified: JSON.stringify(updateData.settings),
    })

    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenant_id)
      .select('id, name, slug, settings')
      .single()

    if (updateError) {
      console.error('❌ Erro ao atualizar tenant:', {
        error: updateError,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      })
      return NextResponse.json(
        { 
          error: 'Erro ao atualizar features do tenant', 
          details: updateError.message,
          hint: updateError.hint,
        },
        { status: 500 }
      )
    }

    console.log('✅ Tenant atualizado (primeira verificação):', {
      updatedTenant: updatedTenant,
      settingsRetornado: updatedTenant?.settings,
    })

    // Aguardar um pouco e verificar novamente para garantir que foi salvo
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verificar se o settings foi realmente atualizado
    const { data: verifyTenant, error: verifyError } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenant_id)
      .single()

    console.log('✅ Tenant atualizado (verificação final):', {
      updatedTenant: updatedTenant,
      verifyTenant: verifyTenant,
      verifyError: verifyError,
      settingsVerificado: verifyTenant?.settings,
      ocrEnabledVerificado: verifyTenant?.settings?.ocr_instagram_enabled,
    })

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
      message: `Feature OCR Instagram ${ocr_instagram_enabled ? 'habilitada' : 'desabilitada'} com sucesso`,
    })
  } catch (error) {
    console.error('Erro ao atualizar features do tenant:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/tenant-features?tenant_id=xxx
 * Busca as features habilitadas para um tenant específico
 * Apenas admin_global pode acessar
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é admin global
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    if (profile.role !== 'admin_global') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas admin global pode visualizar features.' },
        { status: 403 }
      )
    }

    // Obter tenant_id da query string
    const { searchParams } = new URL(request.url)
    const tenant_id = searchParams.get('tenant_id')

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar settings do tenant
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id, name, slug, settings')
      .eq('id', tenant_id)
      .single()

    if (fetchError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 404 }
      )
    }

    const settings = tenant.settings || {}
    
    return NextResponse.json({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
      features: {
        ocr_instagram_enabled: settings.ocr_instagram_enabled || false,
      },
    })
  } catch (error) {
    console.error('Erro ao buscar features do tenant:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

