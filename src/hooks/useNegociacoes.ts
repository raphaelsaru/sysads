'use client'

import { useState, useCallback } from 'react'

import { Negociacao, NovaNegociacao } from '@/types/crm'
import { createClient } from '@/lib/supabase-browser'
import {
  FALLBACK_CURRENCY_VALUE,
  formatCurrency,
  parseCurrencyInput,
  type SupportedCurrency,
} from '@/lib/currency'

const supabase = createClient()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const negociacoesTable = () => supabase.from('negociacoes') as any

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
  procedimento: string | null
  motivo_nao_venda: string | null
  forma_pagamento_sinal: string | null
  data_mes_venda: string | null
  created_at: string
  created_by: string | null
  updated_by: string | null
}

export type NegociacaoUpdatePayload = Partial<NovaNegociacao>

export function useNegociacoes(currency: SupportedCurrency = FALLBACK_CURRENCY_VALUE) {
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([])
  const [loading, setLoading] = useState(false)
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
        procedimento: negociacao.procedimento ?? undefined,
        motivoNaoVenda: negociacao.motivo_nao_venda ?? undefined,
        formaPagamentoSinal: negociacao.forma_pagamento_sinal ?? undefined,
        dataMesVenda: negociacao.data_mes_venda ?? undefined,
        createdAt: negociacao.created_at,
        createdBy: negociacao.created_by ?? undefined,
        updatedBy: negociacao.updated_by ?? undefined,
      }
    },
    [currency]
  )

  const listarNegociacoes = useCallback(
    async (clienteId: string) => {
      if (!clienteId) {
        setNegociacoes([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data, error } = await negociacoesTable()
          .select('*')
          .eq('cliente_id', clienteId)
          .order('data_contato', { ascending: false })

        if (error) {
          console.error('Erro ao listar negociações:', error)
          throw new Error(`Erro ao listar negociações: ${error.message || 'Erro desconhecido'}`)
        }

        const transformadas = ((data as NegociacaoSupabaseRow[] | null) ?? []).map(formatarNegociacao)
        setNegociacoes(transformadas)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao listar negociações'
        setError(errorMessage)
        console.error('Erro ao listar negociações:', err)
        setNegociacoes([])
      } finally {
        setLoading(false)
      }
    },
    [formatarNegociacao]
  )

  const adicionarNegociacao = useCallback(
    async (nova: NovaNegociacao): Promise<Negociacao> => {
      setLoading(true)
      setError(null)

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          throw new Error('Usuário não autenticado. Faça login novamente.')
        }

        const valorFechadoNumero = parseCurrencyInput(nova.valorFechado ?? null)
        const valorSinalNumero = parseCurrencyInput(nova.valorSinal ?? null)

        const { data: negociacao, error } = await negociacoesTable()
          .insert({
            cliente_id: nova.clienteId,
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
            procedimento: nova.procedimento || null,
            motivo_nao_venda: nova.motivoNaoVenda || null,
            forma_pagamento_sinal: nova.formaPagamentoSinal || null,
            created_by: user.id,
            updated_by: user.id,
          })
          .select()
          .single()

        if (error) {
          console.error('Erro ao criar negociação:', error)
          if (error.message?.includes('network') || error.message?.includes('fetch')) {
            throw new Error('Erro de conexão. Verifique sua internet e tente novamente.')
          }
          if (error.message?.includes('policies')) {
            throw new Error('Erro de permissão. Verifique se você está autenticado.')
          }
          throw new Error(`Erro ao salvar negociação: ${error.message || 'Erro desconhecido'}`)
        }

        if (!negociacao) {
          throw new Error('Negociação não foi criada. Tente novamente.')
        }

        const transformada = formatarNegociacao(negociacao as unknown as NegociacaoSupabaseRow)

        setNegociacoes((prev) =>
          [...prev, transformada].sort((a, b) => b.dataContato.localeCompare(a.dataContato))
        )

        return transformada
      } catch (err) {
        console.error('Erro ao adicionar negociação:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar negociação'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [formatarNegociacao]
  )

  const editarNegociacao = useCallback(
    async (id: string, payload: NegociacaoUpdatePayload): Promise<Negociacao> => {
      setLoading(true)
      setError(null)

      try {
        type NegociacaoUpdateRow = {
          data_contato?: string
          orcamento_enviado?: boolean
          resultado?: Negociacao['resultado']
          qualidade_contato?: Negociacao['qualidadeContato']
          nao_respondeu?: boolean
          valor_fechado?: number | null
          observacao?: string | null
          pagou_sinal?: boolean
          valor_sinal?: number | null
          data_pagamento_sinal?: string | null
          venda_paga?: boolean
          data_pagamento_venda?: string | null
          data_lembrete_chamada?: string | null
          procedimento?: string | null
          motivo_nao_venda?: string | null
          forma_pagamento_sinal?: string | null
          updated_by?: string
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        const updateData: NegociacaoUpdateRow = {}
        if (payload.dataContato !== undefined) updateData.data_contato = payload.dataContato
        if (payload.orcamentoEnviado !== undefined) updateData.orcamento_enviado = payload.orcamentoEnviado
        if (payload.resultado !== undefined) updateData.resultado = payload.resultado
        if (payload.qualidadeContato !== undefined) updateData.qualidade_contato = payload.qualidadeContato
        if (payload.naoRespondeu !== undefined) updateData.nao_respondeu = payload.naoRespondeu
        if (payload.valorFechado !== undefined) {
          updateData.valor_fechado = parseCurrencyInput(payload.valorFechado)
        }
        if (payload.observacao !== undefined) updateData.observacao = payload.observacao || null
        if (payload.pagouSinal !== undefined) updateData.pagou_sinal = payload.pagouSinal
        if (payload.valorSinal !== undefined) {
          updateData.valor_sinal = parseCurrencyInput(payload.valorSinal)
        }
        if (payload.dataPagamentoSinal !== undefined) updateData.data_pagamento_sinal = payload.dataPagamentoSinal || null
        if (payload.vendaPaga !== undefined) updateData.venda_paga = payload.vendaPaga
        if (payload.dataPagamentoVenda !== undefined) updateData.data_pagamento_venda = payload.dataPagamentoVenda || null
        if (payload.dataLembreteChamada !== undefined) updateData.data_lembrete_chamada = payload.dataLembreteChamada || null
        if (payload.procedimento !== undefined) updateData.procedimento = payload.procedimento || null
        if (payload.motivoNaoVenda !== undefined) updateData.motivo_nao_venda = payload.motivoNaoVenda || null
        if (payload.formaPagamentoSinal !== undefined) updateData.forma_pagamento_sinal = payload.formaPagamentoSinal || null
        if (user) updateData.updated_by = user.id

        const { data: negociacao, error } = await negociacoesTable()
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.error('Erro ao atualizar negociação:', error)
          if (error.message?.includes('network') || error.message?.includes('fetch')) {
            throw new Error('Erro de conexão. Verifique sua internet e tente novamente.')
          }
          throw new Error('Erro ao atualizar negociação. Tente novamente.')
        }

        if (!negociacao) {
          throw new Error('Negociação não foi atualizada. Tente novamente.')
        }

        const transformada = formatarNegociacao(negociacao as unknown as NegociacaoSupabaseRow)

        setNegociacoes((prev) => prev.map((n) => (n.id === id ? transformada : n)))

        return transformada
      } catch (err) {
        console.error('Erro ao editar negociação:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erro ao editar negociação'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [formatarNegociacao]
  )

  const excluirNegociacao = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await negociacoesTable().delete().eq('id', id)

      if (error) {
        console.error('Erro ao excluir negociação:', error)
        throw new Error('Erro ao excluir negociação. Tente novamente.')
      }

      setNegociacoes((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error('Erro ao excluir negociação:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir negociação'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    negociacoes,
    loading,
    error,
    listarNegociacoes,
    adicionarNegociacao,
    editarNegociacao,
    excluirNegociacao,
  }
}
