import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
    }

    // Obter o usuário autenticado via cookies
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      console.error('Erro de sessão:', sessionError)
      return NextResponse.json({ error: 'Não autorizado - faça login novamente' }, { status: 401 })
    }

    const user = session.user

    // Buscar o perfil do usuário para verificar se é admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Erro ao buscar perfil do usuário:', profileError)
      return NextResponse.json({ error: 'Erro ao verificar permissões' }, { status: 500 })
    }

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 })
    }

    // Usar service role para bypass RLS quando necessário
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Tentar usar a função RPC otimizada primeiro
    console.log('🔍 Tentando usar função RPC get_user_clientes_admin para usuário:', userId)
    const { data: rpcClientes, error: rpcError } = await serviceSupabase
      .rpc('get_user_clientes_admin', { target_user_id: userId })

    if (!rpcError && rpcClientes) {
      console.log('✅ Clientes obtidos via RPC:', rpcClientes.length, 'clientes')
      return NextResponse.json({ clientes: rpcClientes })
    }

    console.warn('⚠️ Função RPC falhou, usando fallback:', rpcError)

    // Fallback: buscar clientes usando service role (bypass RLS)
    const { data: clientes, error: clientesError } = await serviceSupabase
      .from('clientes')
      .select(`
        id,
        data_contato,
        nome,
        whatsapp_instagram,
        origem,
        orcamento_enviado,
        resultado,
        qualidade_contato,
        valor_fechado,
        observacao
      `)
      .eq('user_id', userId)
      .order('data_contato', { ascending: false })

    if (clientesError) {
      console.error('Erro ao buscar clientes:', clientesError)
      return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
    }

    console.log('✅ Retornando clientes reais para usuário:', userId, 'Total:', clientes?.length || 0)
    return NextResponse.json({ clientes: clientes || [] })
  } catch (error) {
    console.error('Erro na API de clientes:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
