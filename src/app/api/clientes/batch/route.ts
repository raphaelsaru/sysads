import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { BatchImportRequest, BatchImportResult, Cliente } from '@/types/crm'

/**
 * POST /api/clientes/batch
 * Cria múltiplos clientes de uma vez (importação em lote)
 * Verifica duplicatas e retorna resultado detalhado
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Obter dados do request
    const body: BatchImportRequest = await request.json()
    const { users } = body

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Lista de usuários é obrigatória e deve conter ao menos um item' },
        { status: 400 }
      )
    }

    // Buscar clientes existentes para verificar duplicatas
    const { data: existingClientes, error: fetchError } = await supabase
      .from('clientes')
      .select('whatsapp_instagram')
      .in('whatsapp_instagram', users)

    if (fetchError) {
      console.error('Erro ao buscar clientes existentes:', fetchError)
      return NextResponse.json(
        { error: 'Erro ao verificar duplicatas' },
        { status: 500 }
      )
    }

    // Criar set de usernames existentes para busca rápida
    const existingUsernames = new Set(
      existingClientes?.map(c => c.whatsapp_instagram.toLowerCase()) || []
    )

    // Separar usuários novos dos duplicados
    const newUsers: string[] = []
    const duplicates: string[] = []

    users.forEach(username => {
      const normalizedUsername = username.toLowerCase()
      if (existingUsernames.has(normalizedUsername)) {
        duplicates.push(username)
      } else {
        newUsers.push(username)
      }
    })

    // Preparar dados para inserção
    const hoje = new Date().toISOString().split('T')[0]
    const clientesToInsert = newUsers.map(username => ({
      user_id: user.id,
      data_contato: hoje,
      nome: username.startsWith('@') ? username.substring(1) : username, // Remove @ do nome
      whatsapp_instagram: username,
      origem: 'Orgânico / Perfil',
      orcamento_enviado: false,
      resultado: 'Orçamento em Processo',
      qualidade_contato: 'Regular',
      nao_respondeu: false,
      observacao: 'Importado via OCR do Instagram',
    }))

    // Inserir novos clientes
    let createdClientes: any[] = []
    if (clientesToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('clientes')
        .insert(clientesToInsert)
        .select(`
          id,
          data_contato,
          nome,
          whatsapp_instagram,
          origem,
          orcamento_enviado,
          resultado,
          qualidade_contato,
          nao_respondeu,
          valor_fechado,
          observacao,
          created_at
        `)

      if (insertError) {
        console.error('Erro ao inserir clientes:', insertError)
        return NextResponse.json(
          { error: 'Erro ao criar clientes' },
          { status: 500 }
        )
      }

      createdClientes = inserted || []
    }

    // Transformar para o formato esperado
    const transformedClientes: Cliente[] = createdClientes.map(cliente => ({
      id: cliente.id,
      dataContato: cliente.data_contato,
      nome: cliente.nome,
      whatsappInstagram: cliente.whatsapp_instagram,
      origem: cliente.origem as Cliente['origem'],
      orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
      resultado: cliente.resultado as Cliente['resultado'],
      qualidadeContato: cliente.qualidade_contato as Cliente['qualidadeContato'],
      naoRespondeu: cliente.nao_respondeu || false,
      valorFechado: cliente.valor_fechado?.toString(),
      observacao: cliente.observacao,
      createdAt: cliente.created_at,
    }))

    // Montar resultado
    const result: BatchImportResult = {
      created: transformedClientes,
      skipped: duplicates.map(username => ({
        username,
        reason: 'Usuário já existe no CRM',
      })),
      total: users.length,
      success: transformedClientes.length,
      failed: duplicates.length,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar clientes em lote:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

