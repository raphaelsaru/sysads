import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  try {
    console.log('🔍 [API Admin] Buscando usuários...')

    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    // Verificar se é admin global
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'admin_global') {
      console.log('❌ [API Admin] Usuário não é admin global')
      return NextResponse.json({ error: 'Acesso negado - apenas super administradores' }, { status: 403 })
    }

    console.log('✅ [API Admin] Usuário admin global verificado:', user.email)

    // Buscar todos os perfis de usuários com informações dos tenants
    const { data: userProfiles, error: usersError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        role,
        full_name,
        created_at,
        tenant_id,
        tenants (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('❌ [API Admin] Erro ao buscar perfis de usuários:', usersError)
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    // Buscar emails dos usuários usando Admin Client
    const adminClient = createAdminClient()
    const { data: authUsers } = await adminClient.auth.admin.listUsers()

    // Mapear os dados para o formato esperado
    const users = (userProfiles || []).map((profile) => {
      // O Supabase pode retornar tenants como array ou objeto único dependendo do relacionamento
      const tenantsData = profile.tenants as { id: string; name: string } | { id: string; name: string }[] | null
      const tenant = Array.isArray(tenantsData) ? tenantsData[0] : tenantsData
      const authUser = authUsers?.users.find(u => u.id === profile.id)
      
      return {
        id: profile.id,
        email: authUser?.email || 'N/A',
        company_name: tenant?.name || profile.full_name || 'Sem nome',
        currency: 'BRL',
        role: profile.role,
        created_at: profile.created_at,
        tenant_id: profile.tenant_id,
        tenant_name: tenant?.name || null,
      }
    })

    console.log('✅ [API Admin] Usuários encontrados:', users.length)

    return NextResponse.json({ users })
  } catch (error) {
    console.error('❌ [API Admin] Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/admin/users
 * Criar novo usuário (apenas admin_global)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin global
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin_global') {
      return NextResponse.json({ error: 'Acesso negado - apenas super administradores' }, { status: 403 })
    }

    // Parse do body
    const { email, password, full_name, role, tenant_id, phone } = await request.json()

    // Validação
    if (!email || !password || !full_name) {
      return NextResponse.json({ 
        error: 'Email, senha e nome completo são obrigatórios' 
      }, { status: 400 })
    }

    // Validar role
    const validRoles = ['admin_global', 'tenant_admin', 'tenant_user']
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ 
        error: 'Role inválida. Use: admin_global, tenant_admin ou tenant_user' 
      }, { status: 400 })
    }

    const newUserRole = role || 'tenant_user'

    // Se não for admin_global, precisa de tenant_id
    if (newUserRole !== 'admin_global' && !tenant_id) {
      return NextResponse.json({ 
        error: 'Tenant é obrigatório para roles tenant_admin e tenant_user' 
      }, { status: 400 })
    }

    // Verificar limite de usuários do tenant (se aplicável)
    if (tenant_id && newUserRole !== 'admin_global') {
      const { data: checkLimit } = await supabase.rpc('check_user_limit', {
        p_tenant_id: tenant_id
      })

      if (!checkLimit) {
        return NextResponse.json({ 
          error: 'Limite de usuários atingido para este tenant' 
        }, { status: 400 })
      }
    }

    // Criar usuário usando Admin Client
    try {
      const adminClient = createAdminClient()

      // Criar usuário no Auth
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
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
          tenant_id: newUserRole === 'admin_global' ? null : tenant_id,
          role: newUserRole,
          full_name: full_name,
          phone: phone || null,
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
