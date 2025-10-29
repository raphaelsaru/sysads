import { getSupabaseClient } from '@lib/supabase'
import type { Cliente, NovoCliente, ClienteEstatisticas } from '@core/types/crm'
import { parseCurrencyInput } from '@core/utils/currency'

const baseSelect = `
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
`

const mapCliente = (row: Record<string, any>): Cliente => {
  const valorFechado = typeof row.valor_fechado === 'number'
    ? row.valor_fechado
    : typeof row.valor_fechado === 'string'
      ? Number(row.valor_fechado) || null
      : null

  return {
    id: row.id,
    dataContato: row.data_contato,
    nome: row.nome,
    whatsappInstagram: row.whatsapp_instagram,
    origem: row.origem,
    orcamentoEnviado: row.orcamento_enviado ? 'Sim' : 'Não',
    resultado: row.resultado,
    qualidadeContato: row.qualidade_contato,
    naoRespondeu: row.nao_respondeu || false,
    valorFechado: valorFechado !== null ? String(valorFechado) : undefined,
    valorFechadoNumero: valorFechado,
    observacao: row.observacao ?? undefined,
    createdAt: row.created_at,
  }
}

export const clientesService = {
  async listar(): Promise<Cliente[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('clientes')
      .select(baseSelect)
      .order('data_contato', { ascending: false })

    if (error) {
      throw error
    }

    return (data ?? []).map(mapCliente)
  },

  async criar(payload: NovoCliente): Promise<Cliente> {
    const supabase = getSupabaseClient()

    // Obter usuário autenticado
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        user_id: user.id,
        data_contato: payload.dataContato,
        nome: payload.nome,
        whatsapp_instagram: payload.whatsappInstagram,
        origem: payload.origem,
        orcamento_enviado: payload.orcamentoEnviado === 'Sim',
        resultado: payload.resultado,
        qualidade_contato: payload.qualidadeContato,
        nao_respondeu: payload.naoRespondeu || false,
        valor_fechado: parseCurrencyInput(payload.valorFechado),
        observacao: payload.observacao ?? null,
      })
      .select(baseSelect)
      .single()

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error('Cliente não retornado pela API')
    }

    return mapCliente(data)
  },

  async atualizar(id: string, payload: Partial<NovoCliente>): Promise<Cliente> {
    const supabase = getSupabaseClient()
    const updateData: Record<string, unknown> = {}

    if (payload.dataContato) updateData.data_contato = payload.dataContato
    if (payload.nome) updateData.nome = payload.nome
    if (payload.whatsappInstagram) updateData.whatsapp_instagram = payload.whatsappInstagram
    if (payload.origem) updateData.origem = payload.origem
    if (payload.orcamentoEnviado) updateData.orcamento_enviado = payload.orcamentoEnviado === 'Sim'
    if (payload.resultado) updateData.resultado = payload.resultado
    if (payload.qualidadeContato) updateData.qualidade_contato = payload.qualidadeContato
    if (payload.naoRespondeu !== undefined) updateData.nao_respondeu = payload.naoRespondeu
    if (payload.valorFechado !== undefined) {
      updateData.valor_fechado = parseCurrencyInput(payload.valorFechado)
    }
    if (payload.observacao !== undefined) updateData.observacao = payload.observacao ?? null

    const { data, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', id)
      .select(baseSelect)
      .single()

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error('Cliente atualizado não retornado pela API')
    }

    return mapCliente(data)
  },

  async remover(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('clientes').delete().eq('id', id)

    if (error) {
      throw error
    }
  },

  async estatisticas(): Promise<ClienteEstatisticas> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('clientes')
      .select('resultado, valor_fechado')

    if (error) {
      throw error
    }

    let total = 0
    let vendas = 0
    let emProcesso = 0
    let naoVenda = 0
    let valorEmProcesso = 0
    let valorVendido = 0

    for (const item of data ?? []) {
      total += 1
      const valorNumerico = typeof item.valor_fechado === 'number'
        ? item.valor_fechado
        : typeof item.valor_fechado === 'string'
          ? Number(item.valor_fechado) || 0
          : 0

      switch (item.resultado) {
        case 'Venda':
          vendas += 1
          valorVendido += valorNumerico
          break
        case 'Orçamento em Processo':
          emProcesso += 1
          valorEmProcesso += valorNumerico
          break
        case 'Não Venda':
          naoVenda += 1
          break
        default:
          break
      }
    }

    return {
      total,
      vendas,
      emProcesso,
      naoVenda,
      valorEmProcesso,
      valorVendido,
    }
  },
}
