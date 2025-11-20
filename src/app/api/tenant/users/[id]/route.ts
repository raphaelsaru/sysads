import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/tenant/users/[id]
 * Obter detalhes de um usuário
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

    // Buscar perfil do usuário autenticado
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    // Buscar usuário alvo
    const { data: targetUser, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Verificar permissão (admin global vê todos, tenant_admin vê do próprio tenant)
    if (profile?.role !== 'admin_global') {
      if (profile?.role !== 'tenant_admin' || profile?.tenant_id !== targetUser.tenant_id) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
    }

    return NextResponse.json({ user: targetUser })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * PUT /api/tenant/users/[id]
 * Atualizar usuário
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

    // Buscar perfil do usuário autenticado
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    // Apenas admins podem atualizar outros usuários
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'admin_global') {
      // Usuários podem atualizar a si mesmos
      if (user.id !== id) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
    }

    // Buscar usuário alvo
    const { data: targetUser } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', id)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Tenant admin só pode atualizar usuários do próprio tenant
    if (profile?.role === 'tenant_admin' && profile.tenant_id !== targetUser.tenant_id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Parse do body
    const updates = await request.json()

    // Não permitir atualização de campos sensíveis por tenant_admin
    if (profile?.role === 'tenant_admin') {
      delete updates.tenant_id
      if (updates.role === 'admin_global') {
        return NextResponse.json({ 
          error: 'Tenant admin não pode criar admin global' 
        }, { status: 403 })
      }
    }

    // Se usuário comum está se atualizando, não pode mudar role ou tenant
    if (user.id === id && profile?.role === 'tenant_user') {
      delete updates.role
      delete updates.tenant_id
    }

    // Atualizar usuário
    const { data: updatedUser, error: updateError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/tenant/users/[id]
 * Remover usuário do tenant
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

    // Não permitir que usuário delete a si mesmo
    if (user.id === id) {
      return NextResponse.json({ error: 'Você não pode deletar sua própria conta' }, { status: 400 })
    }

    // Buscar perfil do usuário autenticado
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    // Apenas admins podem deletar usuários
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas admins' }, { status: 403 })
    }

    // Buscar usuário alvo
    const { data: targetUser } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', id)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Tenant admin só pode deletar usuários do próprio tenant
    if (profile?.role === 'tenant_admin') {
      if (profile.tenant_id !== targetUser.tenant_id) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
      // Tenant admin não pode deletar outros admins
      if (targetUser.role === 'tenant_admin' || targetUser.role === 'admin_global') {
        return NextResponse.json({ error: 'Você não pode deletar outros admins' }, { status: 403 })
      }
    }

    // Deletar usuário (ou melhor, remover do tenant)
    const { error: deleteError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao deletar usuário:', deleteError)
      return NextResponse.json({ error: 'Erro ao deletar usuário' }, { status: 500 })
    }

    console.log('✅ Usuário removido:', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}






