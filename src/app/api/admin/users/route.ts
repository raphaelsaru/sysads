import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API Admin Users - Iniciando verificação...')

    // Tentar obter usuário via Authorization header primeiro
    let user = null
    let authError = null
    
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      console.log('🔑 Tentando obter usuário via Authorization header...')
      
      try {
        const supabase = await createClient()
        const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
        
        if (!tokenError && tokenUser) {
          console.log('✅ Usuário obtido via token:', tokenUser.id, tokenUser.email)
          user = tokenUser
        } else {
          console.log('❌ Erro ao obter usuário via token:', tokenError?.message)
          authError = tokenError
        }
      } catch (tokenError) {
        console.log('❌ Exceção ao obter usuário via token:', tokenError)
        authError = tokenError
      }
    }
    
    // Se não conseguiu via token, tentar via cookies
    if (!user) {
      try {
        console.log('🍪 Tentando obter usuário via cookies...')
        const supabase = await createClient()
        const { data: { user: authUser }, error: cookieAuthError } = await supabase.auth.getUser()
        
        if (cookieAuthError) {
          console.log('❌ Erro ao obter usuário via cookies:', cookieAuthError.message)
          authError = cookieAuthError
        } else if (authUser) {
          console.log('✅ Usuário obtido via cookies:', authUser.id, authUser.email)
          user = authUser
        } else {
          console.log('⚠️ Nenhum usuário encontrado via cookies')
        }
      } catch (cookieError) {
        console.log('❌ Exceção ao obter usuário via cookies:', cookieError)
        authError = cookieError
      }
    }

    if (!user) {
      console.log('❌ Nenhum usuário autenticado encontrado')
      return NextResponse.json({ 
        error: 'Não autorizado - token de acesso necessário',
        debug: {
          cookieError: authError?.message,
          hasAuthHeader: !!request.headers.get('authorization')
        }
      }, { status: 401 })
    }

    // Buscar o perfil do usuário para verificar se é admin
    console.log('👤 Verificando perfil do usuário:', user.id)
    const supabase = await createClient()
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.log('❌ Erro ao buscar perfil:', profileError.message)
      return NextResponse.json({ error: 'Erro ao verificar perfil do usuário' }, { status: 500 })
    }

    if (!userProfile || userProfile.role !== 'admin') {
      console.log('❌ Usuário não é admin:', userProfile?.role || 'sem perfil')
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 })
    }

    console.log('✅ Usuário admin verificado:', userProfile.role)

    // Tentar usar a função RPC otimizada primeiro
    console.log('🔍 Tentando usar função RPC get_all_users_admin...')
    const { data: rpcUsers, error: rpcError } = await supabase
      .rpc('get_all_users_admin')

    if (!rpcError && rpcUsers) {
      console.log('✅ Dados obtidos via RPC:', rpcUsers.length, 'usuários')
      const enrichedUsers = rpcUsers.map((user: any) => ({
        id: user.id,
        company_name: user.company_name,
        email: user.email,
        currency: user.currency ?? 'BRL',
        role: user.role ?? 'user',
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
        totalClientes: Number(user.total_clientes) || 0,
        totalVendas: Number(user.total_vendas) || 0,
        valorTotal: Number(user.valor_total) || 0,
        ativo: true, // Por enquanto assumindo que todos estão ativos
      }))

      return NextResponse.json({ users: enrichedUsers })
    }

    console.warn('⚠️ Função RPC falhou, usando fallback:', rpcError)

    // Fallback: buscar usando queries diretas
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, company_name, email, currency, role, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError)
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    // Enriquecer dados com estatísticas de cada usuário
    const enrichedUsers = await Promise.all(
      users.map(async (usuario) => {
        // Contar clientes
        const { count: clientesCount, error: countError } = await supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', usuario.id)

        // Contar vendas e calcular valor total
        const { data: vendas, error: vendasError } = await supabase
          .from('clientes')
          .select('valor_fechado')
          .eq('user_id', usuario.id)
          .eq('resultado', 'Venda')

        if (countError) {
          console.error('Erro ao contar clientes para usuário', usuario.id, countError)
        }

        if (vendasError) {
          console.error('Erro ao calcular vendas para usuário', usuario.id, vendasError)
        }

        const totalVendas = vendas?.length ?? 0
        const valorTotal = vendas?.reduce((acc, v) => acc + (v.valor_fechado ?? 0), 0) ?? 0

        return {
          id: usuario.id,
          company_name: usuario.company_name,
          email: usuario.email,
          currency: usuario.currency ?? 'BRL',
          role: usuario.role ?? 'user',
          created_at: usuario.created_at,
          updated_at: usuario.updated_at || usuario.created_at,
          totalClientes: clientesCount ?? 0,
          totalVendas: totalVendas,
          valorTotal: valorTotal,
          ativo: true, // Por enquanto assumindo que todos estão ativos
        }
      })
    )

    return NextResponse.json({ users: enrichedUsers })
  } catch (error) {
    console.error('Erro na API de usuários:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
