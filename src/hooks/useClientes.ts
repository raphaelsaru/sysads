'use client'

import { useState, useEffect, useCallback } from 'react'

import { Cliente, Negociacao, NovaNegociacao, NovoCliente } from '@/types/crm'
import { createClient } from '@/lib/supabase-browser'
import {
  FALLBACK_CURRENCY_VALUE,
  formatCurrency,
  parseCurrencyInput,
  type SupportedCurrency,
} from '@/lib/currency'

const supabase = createClient()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientesTable = () => supabase.from('clientes') as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const negociacoesTable = () => supabase.from('negociacoes') as any

const PAGE_SIZE = 15
const STATS_PAGE_SIZE = 5000

/**
 * Erro específico de dedup: find_or_create_cliente encontrou um cliente já
 * existente (mesmo telefone/instagram normalizado) e a chamada NÃO pediu pra
 * seguir mesmo assim (permitirDuplicado). O form de criação manual usa isso
 * pra mostrar um link pro cliente já cadastrado em vez de criar duplicata.
 */
export class ClienteDuplicadoError extends Error {
  duplicado = true as const
  clienteId: string

  constructor(clienteId: string) {
    super('Já existe um cliente cadastrado com esse telefone/instagram.')
    this.name = 'ClienteDuplicadoError'
    this.clienteId = clienteId
  }
}

export interface AdicionarClienteOptions {
  // Dados da negociação inicial a criar junto (form de criação já unificado
  // pessoa+negociação). Se omitido, só a pessoa é criada/encontrada — nenhuma
  // negociação é gerada (usado hoje, já que o form de criação manual ainda
  // não envia esses campos — Fase 2/Task 6.x).
  negociacaoInicial?: Omit<NovaNegociacao, 'clienteId'>
  // Se true, segue e cria a negociação inicial mesmo quando find_or_create_cliente
  // encontrar um cliente já existente (created: false) — usado por fluxos que
  // sabem lidar com duplicata (ex.: import em lote). Default false: bloqueia
  // com ClienteDuplicadoError, que é o comportamento decidido pro form manual.
  permitirDuplicado?: boolean
}

export interface ClienteFiltrosInput {
  busca?: string
  origem?: string
  resultado?: string
  qualidadeContato?: string
  valorMin?: number
  valorMax?: number
  naoRespondeu?: boolean
  comSinal?: boolean
  vendaPaga?: boolean
  mes?: string // formato YYYY-MM
  categoria?: string
}

interface EstatisticasClientes {
  total: number
  vendas: number
  emProcesso: number
  naoVenda: number
  valorEmProcesso: number
  valorVendido: number
  vendasPagas: number
  vendasPendentes: number
  comSinal: number
  valorPendente: number
}

const estatisticasIniciais: EstatisticasClientes = {
  total: 0,
  vendas: 0,
  emProcesso: 0,
  naoVenda: 0,
  valorEmProcesso: 0,
  valorVendido: 0,
  vendasPagas: 0,
  vendasPendentes: 0,
  comSinal: 0,
  valorPendente: 0,
}

// Colunas de negociacoes usadas tanto no embed de carregarClientes/carregarMaisClientes
// quanto (implicitamente, campo a campo) no insert de negociação inicial.
const NEGOCIACAO_COLUMNS = `
  id, cliente_id, data_contato, orcamento_enviado, resultado, qualidade_contato,
  nao_respondeu, valor_fechado, observacao, pagou_sinal, valor_sinal,
  data_pagamento_sinal, venda_paga, data_pagamento_venda, data_lembrete_chamada,
  data_mes_venda, created_at, created_by, updated_by
`

// Select de clientes + última negociação (embed ordenado por data_contato desc,
// limitado a 1). Sempre um embed normal (left join): quando há filtro que só
// existe em negociacoes (resultado, valor, etc.), o cliente já foi restringido
// antes disso via buscarClienteIdsFiltrados + .in('id', ids) — nunca usamos
// `negociacoes!inner(...)` aqui, porque o `count: 'exact'` do PostgREST conta
// LINHAS DO JOIN (uma por negociação), não clientes distintos, o que inflava
// total/hasMore quando um cliente tinha mais de uma negociação.
function selectClientes() {
  return `
    id, data_contato, nome, whatsapp_instagram, origem, observacao, created_at,
    categoria, user_id,
    negociacoes(${NEGOCIACAO_COLUMNS})
  `
}

function temFiltroDeNegociacao(filtros?: ClienteFiltrosInput): boolean {
  if (!filtros) return false
  return (
    filtros.resultado !== undefined ||
    filtros.qualidadeContato !== undefined ||
    filtros.valorMin !== undefined ||
    filtros.valorMax !== undefined ||
    filtros.naoRespondeu !== undefined ||
    filtros.comSinal !== undefined ||
    filtros.vendaPaga !== undefined ||
    filtros.mes !== undefined
  )
}

type NegociacaoSupabaseRow = {
  id: string
  cliente_id: string
  data_contato: string
  orcamento_enviado: boolean
  resultado: Negociacao['resultado']
  qualidade_contato: Negociacao['qualidadeContato']
  nao_respondeu: boolean
  valor_fechado: number | null
  observacao: string | null
  pagou_sinal: boolean
  valor_sinal: number | null
  data_pagamento_sinal: string | null
  venda_paga: boolean
  data_pagamento_venda: string | null
  data_lembrete_chamada: string | null
  data_mes_venda: string | null
  created_at: string
  created_by: string | null
  updated_by: string | null
}

type ClienteSupabaseRow = {
  id: string
  data_contato: string
  nome: string
  whatsapp_instagram: string
  origem: Cliente['origem']
  observacao: string | null
  created_at: string
  categoria: string | null
  user_id: string
  negociacoes?: NegociacaoSupabaseRow[] | null
}

// Estatísticas agora vêm de negociacoes (resultado/valor/pagamento não são
// mais colunas de clientes). O join com clientes só entra quando é preciso
// escopar por targetUserId (negociacoes não tem user_id próprio).
type NegociacaoStatsRow = {
  resultado: Negociacao['resultado']
  valor_fechado: number | null
  venda_paga: boolean | null
  pagou_sinal: boolean | null
}

// Filtros que vivem em `clientes` (pessoa) — sempre aplicados direto na
// tabela clientes, com ou sem filtro de negociação ativo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltrosPessoa(query: any, filtros?: ClienteFiltrosInput) {
  if (!filtros) return query

  if (filtros.busca && filtros.busca.trim()) {
    const termo = filtros.busca.trim().replace(/[%,]/g, '')
    query = query.or(`nome.ilike.%${termo}%,whatsapp_instagram.ilike.%${termo}%`)
  }

  if (filtros.origem) {
    query = query.eq('origem', filtros.origem)
  }

  if (filtros.categoria) {
    query = query.eq('categoria', filtros.categoria)
  }

  return query
}

// Filtros que vivem em `negociacoes` — aplicados direto na tabela negociacoes
// (colunas simples, sem dot-path) por buscarClienteIdsFiltrados, nunca mais
// via embed `!inner` + count (ver nota em selectClientes).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltrosNegociacao(query: any, filtros?: ClienteFiltrosInput) {
  if (!filtros) return query

  if (filtros.resultado) {
    query = query.eq('resultado', filtros.resultado)
  }

  if (filtros.qualidadeContato) {
    query = query.eq('qualidade_contato', filtros.qualidadeContato)
  }

  if (filtros.valorMin !== undefined && !Number.isNaN(filtros.valorMin)) {
    query = query.gte('valor_fechado', filtros.valorMin)
  }

  if (filtros.valorMax !== undefined && !Number.isNaN(filtros.valorMax)) {
    query = query.lte('valor_fechado', filtros.valorMax)
  }

  if (filtros.naoRespondeu !== undefined) {
    query = query.eq('nao_respondeu', filtros.naoRespondeu)
  }

  if (filtros.comSinal !== undefined) {
    query = filtros.comSinal
      ? query.not('valor_sinal', 'is', null)
      : query.is('valor_sinal', null)
  }

  if (filtros.vendaPaga !== undefined) {
    query = query.eq('venda_paga', filtros.vendaPaga)
  }

  if (filtros.mes) {
    const [ano, mes] = filtros.mes.split('-').map(Number)
    if (!Number.isNaN(ano) && !Number.isNaN(mes)) {
      const inicio = `${filtros.mes}-01`
      const proximoMes = new Date(ano, mes, 1)
      const fim = proximoMes.toISOString().split('T')[0]
      // data_mes_venda = data_pagamento_sinal (se a venda tiver) senão data_contato
      query = query.gte('data_mes_venda', inicio).lt('data_mes_venda', fim)
    }
  }

  return query
}

// Quando há filtro de negociação ativo, resolvemos primeiro o conjunto de
// cliente_id que batem no filtro consultando `negociacoes` diretamente (sem
// embed), e deduplicamos em JS — isso dá a contagem exata de clientes
// distintos (ao contrário de `negociacoes!inner(...)` + `count: 'exact'`, que
// conta linhas do JOIN, uma por negociação). ~3958 clientes no total hoje, um
// único select sem paginação aqui é suficiente.
async function buscarClienteIdsFiltrados(
  filtros: ClienteFiltrosInput | undefined,
  targetUserId?: string | null,
): Promise<string[]> {
  let query = targetUserId
    ? negociacoesTable().select('cliente_id, clientes!inner(user_id)').eq('clientes.user_id', targetUserId)
    : negociacoesTable().select('cliente_id')

  query = aplicarFiltrosNegociacao(query, filtros)

  const { data, error } = await query
  if (error) throw error

  const linhas = (data as { cliente_id: string }[] | null) ?? []
  return [...new Set(linhas.map((linha) => linha.cliente_id))]
}

export function useClientes(
  currency: SupportedCurrency = FALLBACK_CURRENCY_VALUE,
  targetUserId?: string | null,
  filtros?: ClienteFiltrosInput,
) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMais, setLoadingMais] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [estatisticas, setEstatisticas] = useState<EstatisticasClientes>(estatisticasIniciais)
  const [error, setError] = useState<string | null>(null)

  const formatarNegociacao = useCallback(
    (negociacao: NegociacaoSupabaseRow): Negociacao => {
      const valorFechadoNumero = negociacao.valor_fechado ?? null
      const valorSinalNumero = negociacao.valor_sinal ?? null

      return {
        id: negociacao.id,
        clienteId: negociacao.cliente_id,
        dataContato: negociacao.data_contato,
        orcamentoEnviado: negociacao.orcamento_enviado,
        resultado: negociacao.resultado,
        qualidadeContato: negociacao.qualidade_contato ?? undefined,
        naoRespondeu: negociacao.nao_respondeu || false,
        valorFechadoNumero,
        valorFechado: valorFechadoNumero !== null ? formatCurrency(valorFechadoNumero, currency) : '',
        observacao: negociacao.observacao ?? undefined,
        pagouSinal: negociacao.pagou_sinal || false,
        valorSinalNumero,
        valorSinal: valorSinalNumero !== null ? formatCurrency(valorSinalNumero, currency) : '',
        dataPagamentoSinal: negociacao.data_pagamento_sinal ?? undefined,
        vendaPaga: negociacao.venda_paga || false,
        dataPagamentoVenda: negociacao.data_pagamento_venda ?? undefined,
        dataLembreteChamada: negociacao.data_lembrete_chamada ?? undefined,
        dataMesVenda: negociacao.data_mes_venda ?? undefined,
        createdAt: negociacao.created_at,
        createdBy: negociacao.created_by ?? undefined,
        updatedBy: negociacao.updated_by ?? undefined,
      }
    },
    [currency]
  )

  const formatarCliente = useCallback(
    (cliente: ClienteSupabaseRow): Cliente => {
      const negociacoesOrdenadas = (cliente.negociacoes ?? []).map(formatarNegociacao)

      return {
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem,
        observacao: cliente.observacao ?? undefined,
        createdAt: cliente.created_at,
        categoria: cliente.categoria ?? undefined,
        userId: cliente.user_id,
        negociacoes: negociacoesOrdenadas,
        ultimaNegociacao: negociacoesOrdenadas[0],
      }
    },
    [formatarNegociacao]
  )

  const carregarEstatisticas = useCallback(async () => {
    let vendas = 0
    let emProcesso = 0
    let naoVenda = 0
    let valorEmProcesso = 0
    let valorVendido = 0
    let vendasPagas = 0
    let vendasPendentes = 0
    let comSinal = 0
    let valorPendente = 0
    let offset = 0

    try {
      // total agora é contagem de clientes (pessoas), não de negociações —
      // um cliente pode existir sem nenhuma negociação ainda.
      let totalQuery = clientesTable().select('id', { count: 'exact', head: true })
      if (targetUserId) totalQuery = totalQuery.eq('user_id', targetUserId)
      const { count: totalClientes, error: totalError } = await totalQuery
      if (totalError) throw totalError

      while (true) {
        // negociacoes não tem user_id: pra escopar por targetUserId precisamos
        // do join com clientes (!inner) e filtrar clientes.user_id.
        let query = targetUserId
          ? negociacoesTable()
              .select('resultado, valor_fechado, venda_paga, pagou_sinal, clientes!inner(user_id)')
              .eq('clientes.user_id', targetUserId)
          : negociacoesTable().select('resultado, valor_fechado, venda_paga, pagou_sinal')

        query = query.order('id', { ascending: true }).range(offset, offset + STATS_PAGE_SIZE - 1)
        const { data, error } = await query

        if (error) {
          console.error('❌ Erro ao carregar estatísticas:', error)
          throw error
        }

        const lote = (data as NegociacaoStatsRow[] | null) ?? []

        if (lote.length === 0) {
          break
        }

        for (const item of lote) {
          switch (item.resultado) {
            case 'Venda':
              vendas += 1
              if (item.valor_fechado !== null) {
                valorVendido += Number(item.valor_fechado) || 0
              }
              if (item.venda_paga) {
                vendasPagas += 1
              } else {
                vendasPendentes += 1
                if (item.valor_fechado !== null) {
                  valorPendente += Number(item.valor_fechado) || 0
                }
              }
              if (item.pagou_sinal) {
                comSinal += 1
              }
              break
            case 'Orçamento em Processo':
              emProcesso += 1
              if (item.valor_fechado !== null) {
                valorEmProcesso += Number(item.valor_fechado) || 0
              }
              break
            case 'Não Venda':
              naoVenda += 1
              break
            default:
              break
          }
        }

        if (lote.length < STATS_PAGE_SIZE) {
          break
        }

        offset += STATS_PAGE_SIZE
      }

      setEstatisticas({
        total: totalClientes ?? 0,
        vendas,
        emProcesso,
        naoVenda,
        valorEmProcesso,
        valorVendido,
        vendasPagas,
        vendasPendentes,
        comSinal,
        valorPendente,
      })
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error)
      setEstatisticas(estatisticasIniciais)
    }
  }, [targetUserId])

  const carregarClientes = useCallback(async () => {
    setLoading(true)
    setError(null)

    const timeoutId = setTimeout(() => {
      console.warn('⏰ Timeout de 5s ao carregar clientes - liberando UI')
      setLoading(false)
    }, 5000)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('❌ Usuário não autenticado:', authError)
        setHasMore(false)
        setClientes([])
        setTotal(0)
        clearTimeout(timeoutId)
        setLoading(false)
        return
      }

      const comFiltroDeNegociacao = temFiltroDeNegociacao(filtros)

      // Filtro de negociação ativo: resolve o conjunto exato (deduplicado)
      // de clientes primeiro — ver buscarClienteIdsFiltrados.
      let idsFiltrados: string[] | null = null
      if (comFiltroDeNegociacao) {
        idsFiltrados = await buscarClienteIdsFiltrados(filtros, targetUserId)
      }

      let query = clientesTable()
        .select(selectClientes(), idsFiltrados === null ? { count: 'exact' } : undefined)
        .order('created_at', { ascending: false })
        .order('data_contato', { ascending: false, foreignTable: 'negociacoes' })
        .limit(1, { foreignTable: 'negociacoes' })
      if (targetUserId) query = query.eq('user_id', targetUserId)
      query = aplicarFiltrosPessoa(query, filtros)
      if (idsFiltrados !== null) query = query.in('id', idsFiltrados)
      query = query.range(0, PAGE_SIZE - 1)

      const { data: clientesData, error, count } = await query

      if (error) {
        console.error('Erro ao carregar clientes:', error)
        setError(error.message || 'Erro ao carregar clientes')
        setHasMore(false)
        setClientes([])
        setTotal(0)
        clearTimeout(timeoutId)
        setLoading(false)
        return
      }

      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)
      const totalCount = idsFiltrados !== null ? idsFiltrados.length : (count ?? transformados.length)

      setClientes(transformados)
      setTotal(totalCount)
      setHasMore(transformados.length < totalCount)
      setPage(1)

      carregarEstatisticas().catch(() => {})
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      setError(error instanceof Error ? error.message : 'Erro ao carregar clientes')
      setClientes([])
      setTotal(0)
      setHasMore(false)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [carregarEstatisticas, formatarCliente, targetUserId, filtros])

  const carregarMaisClientes = useCallback(async () => {
    if (loadingMais || !hasMore) return

    setLoadingMais(true)
    setError(null)
    try {
      const start = page * PAGE_SIZE
      const end = start + PAGE_SIZE - 1
      const comFiltroDeNegociacao = temFiltroDeNegociacao(filtros)

      let idsFiltrados: string[] | null = null
      if (comFiltroDeNegociacao) {
        idsFiltrados = await buscarClienteIdsFiltrados(filtros, targetUserId)
      }

      let query = clientesTable()
        .select(selectClientes(), idsFiltrados === null ? { count: 'exact' } : undefined)
        .order('created_at', { ascending: false })
        .order('data_contato', { ascending: false, foreignTable: 'negociacoes' })
        .limit(1, { foreignTable: 'negociacoes' })
      if (targetUserId) query = query.eq('user_id', targetUserId)
      query = aplicarFiltrosPessoa(query, filtros)
      if (idsFiltrados !== null) query = query.in('id', idsFiltrados)
      query = query.range(start, end)

      const { data: clientesData, error, count } = await query

      if (error) {
        console.error('Erro ao carregar mais clientes:', error)
        setError(error.message || 'Erro ao carregar mais clientes')
        setHasMore(false)
        return
      }

      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)
      const totalCount = idsFiltrados !== null ? idsFiltrados.length : (count ?? undefined)

      setClientes((prev) => {
        const existingIds = new Set(prev.map(c => c.id))
        const novos = transformados.filter(c => !existingIds.has(c.id))
        const atualizados = [...prev, ...novos]
        setHasMore(atualizados.length < (totalCount ?? atualizados.length))
        return atualizados
      })
      if (totalCount !== null && totalCount !== undefined) setTotal(totalCount)
      setPage((prev) => prev + 1)
    } catch (error) {
      console.error('Erro ao carregar mais clientes:', error)
      setError(error instanceof Error ? error.message : 'Erro ao carregar mais clientes')
    } finally {
      setLoadingMais(false)
    }
  }, [formatarCliente, hasMore, loadingMais, page, targetUserId, filtros])

  useEffect(() => {
    setPage(0)
    setClientes([])
    setHasMore(true)
    void carregarClientes()
  }, [carregarClientes])

  const adicionarCliente = async (novoCliente: NovoCliente, options?: AdicionarClienteOptions) => {
    setLoading(true)
    setError(null)

    const timeoutId = setTimeout(() => {
      console.warn('⏰ Timeout de 8s ao adicionar cliente - liberando UI')
      setLoading(false)
    }, 8000)

    try {
      const authPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout na verificação de autenticação')), 5000)
      )

      const {
        data: { user },
        error: authError,
      } = await Promise.race([authPromise, timeoutPromise])

      if (authError || !user) {
        clearTimeout(timeoutId)
        setLoading(false)
        throw new Error('Usuário não autenticado. Faça login novamente.')
      }

      const ownerId = targetUserId ?? user.id

      // Dedup-aware: encontra um cliente já existente (telefone/instagram
      // normalizado) ou cria um novo. Substitui o INSERT direto de antes.
      const { data: resultado, error: rpcError } = await supabase
        .rpc('find_or_create_cliente', {
          p_user_id: ownerId,
          p_data_contato: novoCliente.dataContato,
          p_nome: novoCliente.nome,
          p_identificador: novoCliente.whatsappInstagram,
          p_origem: novoCliente.origem,
          p_created_by: user.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .single()

      if (rpcError) {
        console.error('Erro ao criar/encontrar cliente:', rpcError)
        if (rpcError.message?.includes('network') || rpcError.message?.includes('fetch')) {
          throw new Error('Erro de conexão. Verifique sua internet e tente novamente.')
        }
        if (rpcError.message?.includes('policies')) {
          throw new Error('Erro de permissão. Verifique se você está autenticado.')
        }
        throw new Error(`Erro ao salvar cliente: ${rpcError.message || 'Erro desconhecido'}`)
      }

      const { id: clienteId, created } = (resultado ?? {}) as { id: string; created: boolean }

      if (!clienteId) {
        throw new Error('Cliente não foi criado. Tente novamente.')
      }

      if (!created && !options?.permitirDuplicado) {
        throw new ClienteDuplicadoError(clienteId)
      }

      // Cria a negociação inicial associada, se o form já enviou esses dados
      // (decisão b: insert direto em negociacoes, sem passar pelo estado do
      // hook useNegociacoes — este hook não precisa da lista/loading dele,
      // só da capacidade de inserir).
      if (options?.negociacaoInicial) {
        const nova = options.negociacaoInicial
        const valorFechadoNumero = parseCurrencyInput(nova.valorFechado ?? null)
        const valorSinalNumero = parseCurrencyInput(nova.valorSinal ?? null)

        const { error: negociacaoError } = await negociacoesTable().insert({
          cliente_id: clienteId,
          data_contato: nova.dataContato,
          orcamento_enviado: nova.orcamentoEnviado,
          resultado: nova.resultado,
          qualidade_contato: nova.qualidadeContato,
          nao_respondeu: nova.naoRespondeu || false,
          valor_fechado: valorFechadoNumero,
          observacao: nova.observacao || null,
          pagou_sinal: nova.pagouSinal || false,
          valor_sinal: valorSinalNumero,
          data_pagamento_sinal: nova.dataPagamentoSinal || null,
          venda_paga: nova.vendaPaga || false,
          data_pagamento_venda: nova.dataPagamentoVenda || null,
          data_lembrete_chamada: nova.dataLembreteChamada || null,
          created_by: user.id,
          updated_by: user.id,
        })

        if (negociacaoError) {
          console.error('Erro ao criar negociação inicial:', negociacaoError)
          throw new Error(`Cliente salvo, mas a negociação não foi criada: ${negociacaoError.message || 'Erro desconhecido'}`)
        }
      }

      const { data: clienteRow, error: fetchError } = await clientesTable()
        .select(selectClientes())
        .eq('id', clienteId)
        .order('data_contato', { ascending: false, foreignTable: 'negociacoes' })
        .limit(1, { foreignTable: 'negociacoes' })
        .single()

      if (fetchError || !clienteRow) {
        console.error('Erro ao buscar cliente recém-criado:', fetchError)
        throw new Error('Cliente salvo, mas não foi possível recarregar os dados. Tente novamente.')
      }

      const transformado = formatarCliente(clienteRow as ClienteSupabaseRow)

      setClientes((prev) => {
        if (!created) {
          const existe = prev.some((c) => c.id === clienteId)
          return existe ? prev.map((c) => (c.id === clienteId ? transformado : c)) : [transformado, ...prev]
        }
        return [transformado, ...prev]
      })
      if (created) setTotal((prev) => prev + 1)

      carregarEstatisticas().catch(error => {
        console.warn('⚠️ Erro ao carregar estatísticas (não crítico):', error)
      })

      clearTimeout(timeoutId)
      return transformado
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
      setError(error instanceof Error ? error.message : 'Erro ao adicionar cliente')

      if (error instanceof Error && error.message.includes('Timeout')) {
        clearTimeout(timeoutId)
        setLoading(false)
        throw new Error('Tempo de conexão esgotado. Verifique sua internet e tente novamente.')
      }

      clearTimeout(timeoutId)
      throw error
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const editarCliente = async (id: string, dadosAtualizados: Partial<NovoCliente>) => {
    setLoading(true)
    setError(null)
    try {
      // Só campos de pessoa — resultado/valor/pagamento etc. agora vivem em
      // negociacoes e são editados via useNegociacoes.editarNegociacao.
      type ClienteUpdatePayload = {
        data_contato?: string
        nome?: string
        whatsapp_instagram?: string
        origem?: Cliente['origem']
        observacao?: string | null
        categoria?: string | null
        updated_by?: string
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const updateData: ClienteUpdatePayload = {}
      if (dadosAtualizados.dataContato) updateData.data_contato = dadosAtualizados.dataContato
      if (dadosAtualizados.nome) updateData.nome = dadosAtualizados.nome
      if (dadosAtualizados.whatsappInstagram) updateData.whatsapp_instagram = dadosAtualizados.whatsappInstagram
      if (dadosAtualizados.origem) updateData.origem = dadosAtualizados.origem
      if (dadosAtualizados.observacao !== undefined) updateData.observacao = dadosAtualizados.observacao || null
      if (dadosAtualizados.categoria !== undefined) updateData.categoria = dadosAtualizados.categoria || null
      if (user) updateData.updated_by = user.id

      let updateQuery = clientesTable()
        .update(updateData)
        .eq('id', id)
      if (targetUserId) updateQuery = updateQuery.eq('user_id', targetUserId)

      const { data: cliente, error } = await updateQuery
        .select(selectClientes())
        .order('data_contato', { ascending: false, foreignTable: 'negociacoes' })
        .limit(1, { foreignTable: 'negociacoes' })
        .single()

      if (error) {
        console.error('Erro ao atualizar cliente:', error)
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          throw new Error('Erro de conexão. Verifique sua internet e tente novamente.')
        }
        throw new Error('Erro ao atualizar cliente. Tente novamente.')
      }

      if (!cliente) {
        throw new Error('Cliente não foi atualizado. Tente novamente.')
      }

      const transformado = formatarCliente(cliente as ClienteSupabaseRow)

      setClientes((prev) => prev.map((c) => (c.id === id ? transformado : c)))
      return transformado
    } catch (error) {
      console.error('Erro ao editar cliente:', error)
      setError(error instanceof Error ? error.message : 'Erro ao editar cliente')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const excluirCliente = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      let deleteQuery = clientesTable().delete().eq('id', id)
      if (targetUserId) deleteQuery = deleteQuery.eq('user_id', targetUserId)

      const { error } = await deleteQuery

      if (error) {
        console.error('Erro ao excluir cliente:', error)
        throw new Error('Erro ao excluir cliente')
      }

      setClientes((prev) => prev.filter((cliente) => cliente.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
      await carregarEstatisticas()
    } catch (error) {
      console.error('Erro ao excluir cliente:', error)
      setError(error instanceof Error ? error.message : 'Erro ao excluir cliente')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const buscarCliente = (id: string): Cliente | undefined => {
    return clientes.find((cliente) => cliente.id === id)
  }

  return {
    clientes,
    total,
    loading,
    loadingMais,
    hasMore,
    error,
    adicionarCliente,
    editarCliente,
    excluirCliente,
    buscarCliente,
    estatisticas,
    carregarClientes,
    carregarMaisClientes,
  }
}
