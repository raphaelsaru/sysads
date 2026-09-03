import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { BatchImportRequest, BatchImportResult, Cliente } from '@/types/crm'
import { normalizarInstagram } from '@/lib/normalizacao'

/**
 * POST /api/clientes/batch
 * Cria múltiplos clientes de uma vez (importação em lote, via OCR do Instagram)
 * Dedup global por `instagram_normalizado` (mesmo contrato de find_or_create_cliente,
 * usado em POST /api/clientes — Task 3.2/4.1), tanto contra o banco quanto
 * dentro do próprio lote (duas fotos do mesmo direct podem repetir o mesmo
 * @, em variação de case/@).
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

    const MAX_BATCH_SIZE = 100
    if (users.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_BATCH_SIZE} usuários por requisição` },
        { status: 400 }
      )
    }

    // Dedup DENTRO do próprio lote: normalizarInstagram() em vez de match
    // exato de string, pra pegar "@Joao.Silva" e "@joao_silva" (variações de
    // case/@) como o mesmo contato. Itens sem @ detectável (ex.: nomes soltos
    // extraídos do OCR, tipo "Joel Jota") não normalizam — normalizarInstagram
    // retorna null — e ficam de fora do dedup em lote (mesma limitação que a
    // lógica anterior já tinha para esses casos; risco baixo).
    const seenNormalizados = new Set<string>()
    const uniqueUsers: string[] = []
    const batchDuplicates: string[] = []

    users.forEach(username => {
      const normalizado = normalizarInstagram(username)
      if (normalizado !== null) {
        if (seenNormalizados.has(normalizado)) {
          batchDuplicates.push(username)
          return
        }
        seenNormalizados.add(normalizado)
      }
      uniqueUsers.push(username)
    })

    // Cria (ou encontra) cada pessoa via find_or_create_cliente — mesma RPC
    // de dedup GLOBAL (contra instagram_normalizado no banco inteiro, não só
    // os clientes do usuário atual) usada em POST /api/clientes (Task 3.2/4.1).
    // Chamado sequencialmente (lote de OCR costuma ser pequeno — poucos
    // contatos por print de tela) para não abrir dezenas de conexões
    // concorrentes contra o lock consultivo da RPC.
    const hoje = new Date().toISOString().split('T')[0]
    const dbDuplicates: string[] = []
    const errors: string[] = []
    const createdIds: string[] = []

    for (const username of uniqueUsers) {
      const nome = username.startsWith('@') ? username.substring(1) : username

      const { data: resultado, error: rpcError } = await supabase
        .rpc('find_or_create_cliente', {
          p_user_id: user.id,
          p_data_contato: hoje,
          p_nome: nome,
          p_identificador: username,
          p_origem: 'Orgânico / Perfil',
          p_created_by: user.id,
        })
        .single()

      if (rpcError || !resultado) {
        console.error(`Erro ao criar/encontrar cliente (username: ${username}):`, rpcError)
        errors.push(username)
        continue
      }

      const { id, created } = resultado as { id: string; created: boolean }
      if (created) {
        createdIds.push(id)
      } else {
        dbDuplicates.push(username)
      }
    }

    // Cria a negociação inicial de cada cliente novo (mesmos defaults que a
    // importação por OCR sempre usou — sem dados de negociação vindos do
    // OCR em si, só o contato).
    if (createdIds.length > 0) {
      const { error: negociacoesError } = await supabase
        .from('negociacoes')
        .insert(
          createdIds.map(clienteId => ({
            cliente_id: clienteId,
            data_contato: hoje,
            orcamento_enviado: false,
            resultado: 'Orçamento em Processo',
            qualidade_contato: 'Regular',
            nao_respondeu: false,
            observacao: 'Importado via OCR do Instagram',
            created_by: user.id,
            updated_by: user.id,
          }))
        )

      if (negociacoesError) {
        console.error('Erro ao criar negociações da importação em lote:', negociacoesError)
        // Os clientes já foram criados (find_or_create_cliente comitou) —
        // não falha a requisição inteira, só loga. As pessoas ficam sem
        // negociação inicial, mas visíveis/editáveis no CRM.
      }
    }

    // Buscar os clientes recém-criados para montar a resposta
    let createdClientes: any[] = []
    if (createdIds.length > 0) {
      const { data: clientesData, error: fetchCreatedError } = await supabase
        .from('clientes')
        .select('id, data_contato, nome, whatsapp_instagram, origem, observacao, created_at')
        .in('id', createdIds)

      if (fetchCreatedError) {
        console.error('Erro ao buscar clientes criados:', fetchCreatedError)
      } else {
        createdClientes = clientesData || []
      }
    }

    // Transformar para o formato esperado
    const transformedClientes: Cliente[] = createdClientes.map(cliente => ({
      id: cliente.id,
      dataContato: cliente.data_contato,
      nome: cliente.nome,
      whatsappInstagram: cliente.whatsapp_instagram,
      origem: cliente.origem as Cliente['origem'],
      observacao: cliente.observacao ?? undefined,
      createdAt: cliente.created_at,
    }))

    // Montar resultado
    const skipped: Array<{ username: string; reason: string }> = [
      ...batchDuplicates.map(username => ({
        username,
        reason: 'Duplicado dentro do próprio lote importado',
      })),
      ...dbDuplicates.map(username => ({
        username,
        reason: 'Usuário já existe no CRM',
      })),
      ...errors.map(username => ({
        username,
        reason: 'Erro ao processar usuário',
      })),
    ]

    const result: BatchImportResult = {
      created: transformedClientes,
      skipped,
      total: users.length,
      success: transformedClientes.length,
      failed: skipped.length,
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
