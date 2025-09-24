import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API route called')
    console.log('📍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set')
    console.log('🔑 Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set')

    // Verificar se as variáveis de ambiente estão definidas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing environment variables')
      return NextResponse.json({ error: 'Variáveis de ambiente não configuradas' }, { status: 500 })
    }

    // Usar service role para buscar todos os usuários (bypass RLS)
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('📊 Testing database connection...')
    
    // Teste simples primeiro
    const { data: testData, error: testError } = await serviceSupabase
      .from('users')
      .select('count')
      .limit(1)

    if (testError) {
      console.error('❌ Database connection test failed:', testError)
      return NextResponse.json({ error: `Erro de conexão: ${testError.message}` }, { status: 500 })
    }

    console.log('✅ Database connection successful')

    // Buscar todos os usuários usando service role (bypass RLS)
    const { data: users, error: usersError } = await serviceSupabase
      .from('users')
      .select('id, company_name, email, currency, role, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      return NextResponse.json({ error: `Erro ao buscar usuários: ${usersError.message}` }, { status: 500 })
    }

    console.log(`📊 Found ${users?.length || 0} users`)

    // Versão simplificada sem enriquecimento para testar
    const simpleUsers = users?.map(usuario => ({
      id: usuario.id,
      company_name: usuario.company_name,
      email: usuario.email,
      currency: usuario.currency ?? 'BRL',
      role: usuario.role ?? 'user',
      created_at: usuario.created_at,
      updated_at: usuario.updated_at || usuario.created_at,
      totalClientes: 0, // Simplificado para teste
      totalVendas: 0,   // Simplificado para teste
      valorTotal: 0,    // Simplificado para teste
      ativo: true,
    })) || []

    console.log('✅ Returning simplified user data')
    return NextResponse.json({ users: simpleUsers })
  } catch (error) {
    console.error('💥 Unexpected error in API:', error)
    return NextResponse.json({ error: `Erro interno: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 })
  }
}
