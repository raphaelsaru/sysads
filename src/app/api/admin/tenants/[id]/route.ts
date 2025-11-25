import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UpdateTenantInput } from '@/types/crm'

/**
 * GET /api/admin/tenants/[id]
 * Obter detalhes de um tenant específico
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

    // Verificar se é super admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas super admin' }, { status: 403 })
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

    return NextResponse.json({ tenant })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/tenants/[id]
 * Atualizar um tenant
 */
export async function PUT(
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
    const body = await request.json() as UpdateTenantInput

    // Atualizar tenant
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao atualizar tenant:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar tenant' }, { status: 500 })
    }

    console.log('✅ Tenant atualizado:', updatedTenant.name)
    return NextResponse.json({ tenant: updatedTenant })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/tenants/[id]
 * Desativar um tenant (soft delete)
 */
export async function DELETE(
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

    // Verificar se é super admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas super admin' }, { status: 403 })
    }

    // Desativar tenant (soft delete)
    const { error: deleteError } = await supabase
      .from('tenants')
      .update({ is_active: false })
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao desativar tenant:', deleteError)
      return NextResponse.json({ error: 'Erro ao desativar tenant' }, { status: 500 })
    }

    console.log('✅ Tenant desativado:', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}







