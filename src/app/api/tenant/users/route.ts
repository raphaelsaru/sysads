import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { UserRole } from '@/types/crm'

/**
 * GET /api/tenant/users
 * Listar usuários do tenant (apenas tenant_admin ou admin_global)
 */
export async function GET() {
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

    // Apenas admins podem listar usuários
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas admins' }, { status: 403 })
    }

    // Se for admin global, pode ver todos os usuários
    // Se for tenant_admin, só vê os do próprio tenant
    let query = supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profile.role !== 'admin_global') {
      query = query.eq('tenant_id', profile.tenant_id)
    }

    const { data: users, error: usersError } = await query

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError)
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    return NextResponse.json({ users: users || [] })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/tenant/users
 * Criar novo usuário no tenant (apenas tenant_admin ou admin_global)
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

    // Apenas admins podem criar usuários
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas admins' }, { status: 403 })
    }

    // Parse do body
    const { email, password, full_name, role, tenant_id } = await request.json()

    // Validação
    if (!email || !password || !full_name) {
      return NextResponse.json({ 
        error: 'Email, senha e nome completo são obrigatórios' 
      }, { status: 400 })
    }

    // Determinar tenant_id (tenant_admin só pode criar no próprio tenant)
    const targetTenantId = profile.role === 'admin_global' && tenant_id 
      ? tenant_id 
      : profile.tenant_id

    if (!targetTenantId) {
      return NextResponse.json({ error: 'Tenant não especificado' }, { status: 400 })
    }

    // Verificar limite de usuários do tenant
    const { data: checkLimit } = await supabase.rpc('check_user_limit', {
      p_tenant_id: targetTenantId
    })

    if (!checkLimit) {
      return NextResponse.json({ 
        error: 'Limite de usuários atingido para este tenant' 
      }, { status: 400 })
    }

    const newUserRole: UserRole = role || 'tenant_user'

    // Validar que tenant_admin não pode criar admin_global
    if (profile.role === 'tenant_admin' && newUserRole === 'admin_global') {
      return NextResponse.json({ 
        error: 'Tenant admin não pode criar admin global' 
      }, { status: 403 })
    }

    // Validar que tenant_admin só pode criar tenant_user
    if (profile.role === 'tenant_admin' && newUserRole !== 'tenant_user') {
      return NextResponse.json({ 
        error: 'Tenant admin só pode criar usuários comuns' 
      }, { status: 403 })
    }

    // Criar usuário usando Admin Client (service_role)
    try {
      const adminClient = createAdminClient()

      // Criar usuário no Auth
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Email confirmado automaticamente
        user_metadata: {
          full_name: full_name,
        },
      })

      if (createError || !authUser.user) {
        console.error('Erro ao criar usuário no Auth:', createError)
        return NextResponse.json({ 
          error: createError?.message || 'Erro ao criar usuário' 
        }, { status: 500 })
      }

      // Criar perfil do usuário
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authUser.user.id,
          tenant_id: targetTenantId,
          role: newUserRole,
          full_name: full_name,
        })
        .select()
        .single()

      if (profileError) {
        console.error('Erro ao criar perfil do usuário:', profileError)
        
        // Tentar deletar o usuário criado no Auth se falhar
        await adminClient.auth.admin.deleteUser(authUser.user.id)
        
        return NextResponse.json({ 
          error: 'Erro ao criar perfil do usuário' 
        }, { status: 500 })
      }

      console.log('✅ Usuário criado com sucesso:', authUser.user.email)
      return NextResponse.json({ 
        user: userProfile,
        message: 'Usuário criado com sucesso' 
      }, { status: 201 })

    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      return NextResponse.json({ 
        error: 'Erro interno ao criar usuário' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}


