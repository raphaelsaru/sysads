'use client'

import { useState, useEffect, useCallback } from 'react'

import { Cliente, NovoCliente } from '@/types/crm'
import { supabase } from '@/lib/supabase'
import {
  FALLBACK_CURRENCY_VALUE,
  formatCurrency,
  parseCurrencyInput,
  type SupportedCurrency,
} from '@/lib/currency'

const PAGE_SIZE = 15
const STATS_PAGE_SIZE = 500

interface EstatisticasClientes {
  total: number
  vendas: number
  emProcesso: number
  naoVenda: number
  valorEmProcesso: number
  valorVendido: number
}

const estatisticasIniciais: EstatisticasClientes = {
  total: 0,
  vendas: 0,
  emProcesso: 0,
  naoVenda: 0,
  valorEmProcesso: 0,
  valorVendido: 0,
}

type ClienteSupabaseRow = {
  id: string
  data_contato: string
  nome: string
  whatsapp_instagram: string
  origem: Cliente['origem']
  orcamento_enviado: boolean
  resultado: Cliente['resultado']
  qualidade_contato: Cliente['qualidadeContato']
  valor_fechado: number | null
  observacao: string | null
  created_at: string
}

type ClienteStatsRow = {
  resultado: Cliente['resultado']
  valor_fechado: number | null
}

export function useClientes(currency: SupportedCurrency = FALLBACK_CURRENCY_VALUE) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMais, setLoadingMais] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [estatisticas, setEstatisticas] = useState<EstatisticasClientes>(estatisticasIniciais)

  const formatarCliente = useCallback(
    (cliente: ClienteSupabaseRow): Cliente => {
      const valorFechadoNumero = cliente.valor_fechado ?? null

      return {
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem,
        orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
        resultado: cliente.resultado,
        qualidadeContato: cliente.qualidade_contato,
        valorFechadoNumero,
        valorFechado: valorFechadoNumero !== null ? formatCurrency(valorFechadoNumero, currency) : '',
        observacao: cliente.observacao ?? undefined,
        createdAt: cliente.created_at,
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
    let offset = 0

    try {
      // Pagina manualmente para garantir que todos os registros sejam considerados
      // independentemente da paginação utilizada na tabela.
      while (true) {
        const { data, error } = await supabase
          .from('clientes')
          .select('resultado, valor_fechado')
          .order('id', { ascending: true })
          .range(offset, offset + STATS_PAGE_SIZE - 1)

        if (error) {
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
      })
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
      setEstatisticas(estatisticasIniciais)
    }
  }, [])

  const carregarClientes = useCallback(async () => {
    setLoading(true)
    try {
      const { data: clientesData, error } = await supabase
        .from('clientes')
        .select(
          `
          id,
          data_contato,
          nome,
          whatsapp_instagram,
          origem,
          orcamento_enviado,
          resultado,
          qualidade_contato,
          valor_fechado,
          observacao,
          created_at
        `
        )
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      if (error) {
        console.error('Erro ao carregar clientes:', error)
        setHasMore(false)
        return
      }

      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)

      setClientes(transformados)
      setHasMore(((clientesData?.length ?? 0) === PAGE_SIZE))
      setPage(1)
      await carregarEstatisticas()
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
    } finally {
      setLoading(false)
    }
  }, [carregarEstatisticas, formatarCliente])

  const carregarMaisClientes = useCallback(async () => {
    if (loadingMais || !hasMore) return

    setLoadingMais(true)
    try {
      const start = page * PAGE_SIZE
      const end = start + PAGE_SIZE - 1

      const { data: clientesData, error } = await supabase
        .from('clientes')
        .select(
          `
          id,
          data_contato,
          nome,
          whatsapp_instagram,
          origem,
          orcamento_enviado,
          resultado,
          qualidade_contato,
          valor_fechado,
          observacao,
          created_at
        `
        )
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) {
        console.error('Erro ao carregar mais clientes:', error)
        setHasMore(false)
        return
      }

      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)

      setClientes((prev) => [...prev, ...transformados])
      setHasMore(((clientesData?.length ?? 0) === PAGE_SIZE))
      setPage((prev) => prev + 1)
    } catch (error) {
      console.error('Erro ao carregar mais clientes:', error)
    } finally {
      setLoadingMais(false)
    }
  }, [formatarCliente, hasMore, loadingMais, page])

  useEffect(() => {
    void carregarClientes()
  }, [carregarClientes])

  const adicionarCliente = async (novoCliente: NovoCliente) => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Usuário não autenticado. Faça login novamente.')
      }

      const valorFechadoNumero = parseCurrencyInput(novoCliente.valorFechado ?? null)

      const { data: cliente, error } = await supabase
        .from('clientes')
        .insert({
          user_id: user.id,
          data_contato: novoCliente.dataContato,
          nome: novoCliente.nome,
          whatsapp_instagram: novoCliente.whatsappInstagram,
          origem: novoCliente.origem,
          orcamento_enviado: novoCliente.orcamentoEnviado === 'Sim',
          resultado: novoCliente.resultado,
          qualidade_contato: novoCliente.qualidadeContato,
          valor_fechado: valorFechadoNumero,
          observacao: novoCliente.observacao || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao criar cliente:', error)
        console.error('Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
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

      setClientes((prev) => [...prev, transformado])
      await carregarEstatisticas()
      return transformado
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
      throw error
    } finally {
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
        valor_fechado?: number | null
        observacao?: string | null
      }

      const updateData: ClienteUpdatePayload = {}
      if (dadosAtualizados.dataContato) updateData.data_contato = dadosAtualizados.dataContato
      if (dadosAtualizados.nome) updateData.nome = dadosAtualizados.nome
      if (dadosAtualizados.whatsappInstagram) updateData.whatsapp_instagram = dadosAtualizados.whatsappInstagram
      if (dadosAtualizados.origem) updateData.origem = dadosAtualizados.origem
      if (dadosAtualizados.orcamentoEnviado !== undefined) updateData.orcamento_enviado = dadosAtualizados.orcamentoEnviado === 'Sim'
      if (dadosAtualizados.resultado) updateData.resultado = dadosAtualizados.resultado
      if (dadosAtualizados.qualidadeContato) updateData.qualidade_contato = dadosAtualizados.qualidadeContato
      if (dadosAtualizados.valorFechado !== undefined) {
        updateData.valor_fechado = parseCurrencyInput(dadosAtualizados.valorFechado)
      }
      if (dadosAtualizados.observacao !== undefined) updateData.observacao = dadosAtualizados.observacao || null

      const { data: cliente, error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', id)
        .select()
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
      const { error } = await supabase.from('clientes').delete().eq('id', id)

      if (error) {
        console.error('Erro ao excluir cliente:', error)
        throw new Error('Erro ao excluir cliente')
      }

      setClientes((prev) => prev.filter((cliente) => cliente.id !== id))
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
