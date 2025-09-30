import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(_request: NextRequest) {
  try {
    console.log('🔍 [API Admin] Buscando usuários...')

    const supabase = await createClient()
    
    // Debug: verificar cookies
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    console.log('🍪 [API Admin] Cookies disponíveis:', allCookies.map(c => c.name).join(', '))
    
    // Tentar getSession primeiro
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('📋 [API Admin] Session data:', { 
      hasSession: !!session, 
      hasUser: !!session?.user,
      sessionError: sessionError?.message 
    })
    
    // Se não tiver sessão, tentar getUser
    let user = session?.user
    
    if (!user) {
      console.log('⚠️ [API Admin] Tentando getUser()...')
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      console.log('📋 [API Admin] User data:', { hasUser: !!authUser, userError: userError?.message })
      user = authUser
    }
    
    if (!user) {
      console.log('❌ [API Admin] Nenhum usuário encontrado')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    console.log('✅ [API Admin] Usuário encontrado:', user.email)

    // Verificar se é admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      console.log('❌ [API Admin] Usuário não é admin')
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 })
    }

    console.log('✅ [API Admin] Usuário admin verificado:', user.email)

    // Buscar todos os usuários
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, company_name, currency, role, created_at')
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('❌ [API Admin] Erro ao buscar usuários:', usersError)
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    console.log('✅ [API Admin] Usuários encontrados:', users?.length || 0)

    return NextResponse.json({ users: users || [] })
  } catch (error) {
    console.error('❌ [API Admin] Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
