'use client'

import { useState, useEffect, useCallback } from 'react'

import { Cliente, NovoCliente } from '@/types/crm'
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

const PAGE_SIZE = 15
const STATS_PAGE_SIZE = 5000

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

const SELECT_CLIENTE = `
  id, data_contato, nome, whatsapp_instagram, origem,
  orcamento_enviado, resultado, qualidade_contato, nao_respondeu,
  valor_fechado, observacao, created_at,
  pagou_sinal, valor_sinal, data_pagamento_sinal,
  venda_paga, data_pagamento_venda, data_lembrete_chamada, categoria
`

type ClienteSupabaseRow = {
  id: string
  data_contato: string
  nome: string
  whatsapp_instagram: string
  origem: Cliente['origem']
  orcamento_enviado: boolean
  resultado: Cliente['resultado']
  qualidade_contato: Cliente['qualidadeContato']
  nao_respondeu: boolean
  valor_fechado: number | null
  observacao: string | null
  created_at: string
  pagou_sinal: boolean
  valor_sinal: number | null
  data_pagamento_sinal: string | null
  venda_paga: boolean
  data_pagamento_venda: string | null
  data_lembrete_chamada: string | null
  categoria: string | null
}

type ClienteStatsRow = {
  resultado: Cliente['resultado']
  valor_fechado: number | null
  venda_paga: boolean | null
  pagou_sinal: boolean | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(query: any, filtros?: ClienteFiltrosInput) {
  if (!filtros) return query

  if (filtros.busca && filtros.busca.trim()) {
    const termo = filtros.busca.trim().replace(/[%,]/g, '')
    query = query.or(`nome.ilike.%${termo}%,whatsapp_instagram.ilike.%${termo}%`)
  }

  if (filtros.origem) {
    query = query.eq('origem', filtros.origem)
  }

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

  if (filtros.categoria) {
    query = query.eq('categoria', filtros.categoria)
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

  const formatarCliente = useCallback(
    (cliente: ClienteSupabaseRow): Cliente => {
      const valorFechadoNumero = cliente.valor_fechado ?? null
      const valorSinalNumero = cliente.valor_sinal ?? null

      return {
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem,
        orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
        resultado: cliente.resultado,
        qualidadeContato: cliente.qualidade_contato,
        naoRespondeu: cliente.nao_respondeu || false,
        valorFechadoNumero,
        valorFechado: valorFechadoNumero !== null ? formatCurrency(valorFechadoNumero, currency) : '',
        observacao: cliente.observacao ?? undefined,
        createdAt: cliente.created_at,
        pagouSinal: cliente.pagou_sinal || false,
        valorSinalNumero,
        valorSinal: valorSinalNumero !== null ? formatCurrency(valorSinalNumero, currency) : '',
        dataPagamentoSinal: cliente.data_pagamento_sinal ?? undefined,
        vendaPaga: cliente.venda_paga || false,
        dataPagamentoVenda: cliente.data_pagamento_venda ?? undefined,
        dataLembreteChamada: cliente.data_lembrete_chamada ?? undefined,
        categoria: cliente.categoria ?? undefined,
      }
    },
    [currency]
  )

  const carregarEstatisticas = useCallback(async () => {
    let total = 0
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
      while (true) {
        let query = clientesTable()
          .select('resultado, valor_fechado, venda_paga, pagou_sinal')
          .order('id', { ascending: true })
          .range(offset, offset + STATS_PAGE_SIZE - 1)
        if (targetUserId) query = query.eq('user_id', targetUserId)
        const { data, error } = await query

        if (error) {
          console.error('❌ Erro ao carregar estatísticas:', error)
          throw error
        }

        const lote = (data as ClienteStatsRow[] | null) ?? []

        if (lote.length === 0) {
          break
        }

        for (const item of lote) {
          total += 1

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
        total,
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

      let query = clientesTable()
        .select(SELECT_CLIENTE, { count: 'exact' })
        .order('created_at', { ascending: false })
      if (targetUserId) query = query.eq('user_id', targetUserId)
      query = aplicarFiltros(query, filtros)
      query = query.range(0, PAGE_SIZE - 1)

      const { data: clientesData, error, count } = await query

      if (error) {
        console.error('Erro ao carregar clientes:', error)
        setHasMore(false)
        setClientes([])
        setTotal(0)
        clearTimeout(timeoutId)
        setLoading(false)
        return
      }

      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)
      const totalCount = count ?? transformados.length

      setClientes(transformados)
      setTotal(totalCount)
      setHasMore(transformados.length < totalCount)
      setPage(1)

      carregarEstatisticas().catch(() => {})
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
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
    try {
      const start = page * PAGE_SIZE
      const end = start + PAGE_SIZE - 1

      let query = clientesTable()
        .select(SELECT_CLIENTE, { count: 'exact' })
        .order('created_at', { ascending: false })
      if (targetUserId) query = query.eq('user_id', targetUserId)
      query = aplicarFiltros(query, filtros)
      query = query.range(start, end)

      const { data: clientesData, error, count } = await query

      if (error) {
        console.error('Erro ao carregar mais clientes:', error)
        setHasMore(false)
        return
      }

      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)

      setClientes((prev) => {
        const existingIds = new Set(prev.map(c => c.id))
        const novos = transformados.filter(c => !existingIds.has(c.id))
        const atualizados = [...prev, ...novos]
        setHasMore(atualizados.length < (count ?? atualizados.length))
        return atualizados
      })
      if (count !== null && count !== undefined) setTotal(count)
      setPage((prev) => prev + 1)
    } catch (error) {
      console.error('Erro ao carregar mais clientes:', error)
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

  const adicionarCliente = async (novoCliente: NovoCliente) => {
    setLoading(true)

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

      const valorFechadoNumero = parseCurrencyInput(novoCliente.valorFechado ?? null)
      const valorSinalNumero = parseCurrencyInput(novoCliente.valorSinal ?? null)

      const { data: cliente, error } = await clientesTable()
        .insert({
          user_id: targetUserId ?? user.id,
          data_contato: novoCliente.dataContato,
          nome: novoCliente.nome,
          whatsapp_instagram: novoCliente.whatsappInstagram,
          origem: novoCliente.origem,
          orcamento_enviado: novoCliente.orcamentoEnviado === 'Sim',
          resultado: novoCliente.resultado,
          qualidade_contato: novoCliente.qualidadeContato,
          nao_respondeu: novoCliente.naoRespondeu || false,
          valor_fechado: valorFechadoNumero,
          observacao: novoCliente.observacao || null,
          pagou_sinal: novoCliente.pagouSinal || false,
          valor_sinal: valorSinalNumero,
          data_pagamento_sinal: novoCliente.dataPagamentoSinal || null,
          venda_paga: novoCliente.vendaPaga || false,
          data_pagamento_venda: novoCliente.dataPagamentoVenda || null,
          data_lembrete_chamada: novoCliente.dataLembreteChamada || null,
          categoria: novoCliente.categoria || null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao criar cliente:', error)
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          throw new Error('Erro de conexão. Verifique sua internet e tente novamente.')
        }
        if (error.message?.includes('policies')) {
          throw new Error('Erro de permissão. Verifique se você está autenticado.')
        }
        if (error.message?.includes('invalid input')) {
          throw new Error('Dados inválidos. Verifique os campos preenchidos.')
        }
        throw new Error(`Erro ao salvar cliente: ${error.message || 'Erro desconhecido'}`)
      }

      if (!cliente) {
        throw new Error('Cliente não foi criado. Tente novamente.')
      }

      const transformado = formatarCliente(cliente as unknown as ClienteSupabaseRow)

      setClientes((prev) => [transformado, ...prev])
      setTotal((prev) => prev + 1)

      carregarEstatisticas().catch(error => {
        console.warn('⚠️ Erro ao carregar estatísticas (não crítico):', error)
      })

      clearTimeout(timeoutId)
      return transformado
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)

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
    try {
      type ClienteUpdatePayload = {
        data_contato?: string
        nome?: string
        whatsapp_instagram?: string
        origem?: Cliente['origem']
        orcamento_enviado?: boolean
        resultado?: Cliente['resultado']
        qualidade_contato?: Cliente['qualidadeContato']
        nao_respondeu?: boolean
        valor_fechado?: number | null
        observacao?: string | null
        pagou_sinal?: boolean
        valor_sinal?: number | null
        data_pagamento_sinal?: string | null
        venda_paga?: boolean
        data_pagamento_venda?: string | null
        data_lembrete_chamada?: string | null
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
      if (dadosAtualizados.orcamentoEnviado !== undefined) updateData.orcamento_enviado = dadosAtualizados.orcamentoEnviado === 'Sim'
      if (dadosAtualizados.resultado) updateData.resultado = dadosAtualizados.resultado
      if (dadosAtualizados.qualidadeContato) updateData.qualidade_contato = dadosAtualizados.qualidadeContato
      if (dadosAtualizados.naoRespondeu !== undefined) updateData.nao_respondeu = dadosAtualizados.naoRespondeu
      if (dadosAtualizados.valorFechado !== undefined) {
        updateData.valor_fechado = parseCurrencyInput(dadosAtualizados.valorFechado)
      }
      if (dadosAtualizados.observacao !== undefined) updateData.observacao = dadosAtualizados.observacao || null
      if (dadosAtualizados.pagouSinal !== undefined) updateData.pagou_sinal = dadosAtualizados.pagouSinal
      if (dadosAtualizados.valorSinal !== undefined) {
        updateData.valor_sinal = parseCurrencyInput(dadosAtualizados.valorSinal)
      }
      if (dadosAtualizados.dataPagamentoSinal !== undefined) updateData.data_pagamento_sinal = dadosAtualizados.dataPagamentoSinal || null
      if (dadosAtualizados.vendaPaga !== undefined) updateData.venda_paga = dadosAtualizados.vendaPaga
      if (dadosAtualizados.dataPagamentoVenda !== undefined) updateData.data_pagamento_venda = dadosAtualizados.dataPagamentoVenda || null
      if (dadosAtualizados.dataLembreteChamada !== undefined) updateData.data_lembrete_chamada = dadosAtualizados.dataLembreteChamada || null
      if (dadosAtualizados.categoria !== undefined) updateData.categoria = dadosAtualizados.categoria || null
      if (user) updateData.updated_by = user.id

      let updateQuery = clientesTable()
        .update(updateData)
        .eq('id', id)
      if (targetUserId) updateQuery = updateQuery.eq('user_id', targetUserId)

      const { data: cliente, error } = await updateQuery.select().single()

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

      const transformado = formatarCliente(cliente as unknown as ClienteSupabaseRow)

      setClientes((prev) => prev.map((c) => (c.id === id ? transformado : c)))
      await carregarEstatisticas()
      return transformado
    } catch (error) {
      console.error('Erro ao editar cliente:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const excluirCliente = async (id: string) => {
    setLoading(true)
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
    adicionarCliente,
    editarCliente,
    excluirCliente,
    buscarCliente,
    estatisticas,
    carregarClientes,
    carregarMaisClientes,
  }
}
