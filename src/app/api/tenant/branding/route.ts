import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { TenantBranding } from '@/types/crm'

/**
 * PUT /api/tenant/branding
 * Atualizar branding do tenant
 */
export async function PUT(request: NextRequest) {
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

    // Apenas tenant_admin ou admin_global podem atualizar branding
    if (profile.role !== 'tenant_admin' && profile.role !== 'admin_global') {
      return NextResponse.json({ error: 'Apenas admins podem atualizar o branding' }, { status: 403 })
    }

    // Parse do body
    const body = await request.json() as Partial<TenantBranding>

    // Buscar branding atual
    const { data: currentTenant } = await supabase
      .from('tenants')
      .select('branding')
      .eq('id', profile.tenant_id)
      .single()

    if (!currentTenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Merge do branding atual com as atualizações
    const updatedBranding = {
      ...currentTenant.branding,
      ...body
    }

    // Atualizar tenant
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update({ branding: updatedBranding })
      .eq('id', profile.tenant_id)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao atualizar branding:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar branding' }, { status: 500 })
    }

    console.log('✅ Branding atualizado para tenant:', updatedTenant.name)
    return NextResponse.json({ 
      success: true,
      branding: updatedTenant.branding 
    })
  } catch (error) {
    console.error('Erro ao atualizar branding:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/tenant/branding/logo
 * Upload de logo do tenant (será implementado com storage)
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

    // Apenas tenant_admin ou admin_global podem fazer upload
    if (profile.role !== 'tenant_admin' && profile.role !== 'admin_global') {
      return NextResponse.json({ error: 'Apenas admins podem fazer upload de logo' }, { status: 403 })
    }

    // Parse do body (URL temporária ou base64)
    const { logoUrl } = await request.json()

    if (!logoUrl) {
      return NextResponse.json({ error: 'URL do logo é obrigatória' }, { status: 400 })
    }

    // Atualizar branding com novo logo
    const { data: currentTenant } = await supabase
      .from('tenants')
      .select('branding')
      .eq('id', profile.tenant_id)
      .single()

    if (!currentTenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    const updatedBranding = {
      ...currentTenant.branding,
      logo: logoUrl
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update({ branding: updatedBranding })
      .eq('id', profile.tenant_id)

    if (updateError) {
      console.error('Erro ao atualizar logo:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar logo' }, { status: 500 })
    }

    console.log('✅ Logo atualizado para tenant:', profile.tenant_id)
    return NextResponse.json({ 
      success: true,
      logoUrl 
    })
  } catch (error) {
    console.error('Erro ao fazer upload de logo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}






