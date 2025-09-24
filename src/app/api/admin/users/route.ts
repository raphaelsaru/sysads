import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Usar service role para validação e busca (bypass RLS)
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Tentar obter o usuário autenticado via cookies primeiro
    let user = null
    try {
      const supabase = await createClient()
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (!authError && authUser) {
        user = authUser
      }
    } catch (cookieError) {
      console.log('Cookie auth failed, trying header auth:', cookieError)
    }

    // Se não conseguiu via cookies, tentar via header Authorization
    if (!user) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user: tokenUser }, error: tokenError } = await serviceSupabase.auth.getUser(token)
        if (!tokenError && tokenUser) {
          user = tokenUser
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado - token de acesso necessário' }, { status: 401 })
    }

    // Buscar o perfil do usuário para verificar se é admin usando service role
    const { data: userProfile, error: profileError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 })
    }

    // Buscar todos os usuários usando service role (bypass RLS)
    const { data: users, error: usersError } = await serviceSupabase
      .from('users')
      .select('id, company_name, email, currency, role, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError)
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    // Enriquecer dados com estatísticas de cada usuário usando service role
    const enrichedUsers = await Promise.all(
      users.map(async (usuario) => {
        // Contar clientes
        const { count: clientesCount, error: countError } = await serviceSupabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', usuario.id)

        // Contar vendas e calcular valor total
        const { data: vendas, error: vendasError } = await serviceSupabase
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
