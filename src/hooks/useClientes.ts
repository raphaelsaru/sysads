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
  nao_respondeu: boolean
  valor_fechado: number | null
  observacao: string | null
  created_at: string
  // Campos de pagamento
  pagou_sinal: boolean
  valor_sinal: number | null
  data_pagamento_sinal: string | null
  venda_paga: boolean
  data_pagamento_venda: string | null
  // Campo de notificação
  data_lembrete_chamada: string | null
}

type ClienteStatsRow = {
  resultado: Cliente['resultado']
  valor_fechado: number | null
}

export function useClientes(
  currency: SupportedCurrency = FALLBACK_CURRENCY_VALUE,
  targetUserId?: string | null
) {
  const [clientes, setClientes] = useState<Cliente[]>([])
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
        // Campos de pagamento
        pagouSinal: cliente.pagou_sinal || false,
        valorSinalNumero,
        valorSinal: valorSinalNumero !== null ? formatCurrency(valorSinalNumero, currency) : '',
        dataPagamentoSinal: cliente.data_pagamento_sinal ?? undefined,
        vendaPaga: cliente.venda_paga || false,
        dataPagamentoVenda: cliente.data_pagamento_venda ?? undefined,
        // Campo de notificação
        dataLembreteChamada: cliente.data_lembrete_chamada ?? undefined,
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
      console.log('📊 Carregando estatísticas...')
      
      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.warn('⚠️ Usuário não autenticado para estatísticas')
        setEstatisticas(estatisticasIniciais)
        return
      }

      // Usar targetUserId se fornecido, senão usar o user.id
      const effectiveUserId = targetUserId || user.id
      console.log('👤 Carregando estatísticas para usuário:', effectiveUserId)
      
      // Pagina manualmente para garantir que todos os registros sejam considerados
      // independentemente da paginação utilizada na tabela.
      while (true) {
        const { data, error } = await supabase
          .from('clientes')
          .select('resultado, valor_fechado')
          .eq('user_id', effectiveUserId)
          .order('id', { ascending: true })
          .range(offset, offset + STATS_PAGE_SIZE - 1)

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

      console.log('✅ Estatísticas carregadas:', { total, vendas, emProcesso, naoVenda })
      setEstatisticas({
        total,
        vendas,
        emProcesso,
        naoVenda,
        valorEmProcesso,
        valorVendido,
      })
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error)
      setEstatisticas(estatisticasIniciais)
    }
  }, [targetUserId])

  const carregarClientes = useCallback(async () => {
    setLoading(true)
    
    // Timeout de segurança - SEMPRE libera loading após 5 segundos
    const timeoutId = setTimeout(() => {
      console.warn('⏰ Timeout de 5s ao carregar clientes - liberando UI')
      setLoading(false)
    }, 5000)
    
    try {
      console.log('🔄 Iniciando carregamento de clientes...')
      
      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.error('❌ Usuário não autenticado:', authError)
        setHasMore(false)
        setClientes([]) // Garantir que lista fica vazia
        clearTimeout(timeoutId)
        setLoading(false)
        return
      }

      // Usar targetUserId se fornecido, senão usar o user.id
      const effectiveUserId = targetUserId || user.id
      console.log('👤 Carregando clientes para usuário:', effectiveUserId)
      console.log('🔍 Debug - targetUserId:', targetUserId)
      console.log('🔍 Debug - user.id:', user.id)
      
      // Verificar se o usuário é admin para debug
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single()
      
      console.log('🔍 Debug - Perfil do usuário logado:', userProfile)
      
      // Se estiver visualizando como outro usuário, verificar se é admin
      const isAdmin = userProfile?.role === 'admin_global' || userProfile?.role === 'tenant_admin'
      const isImpersonating = targetUserId && targetUserId !== user.id
      
      console.log('🔍 Debug - É admin?', isAdmin)
      console.log('🔍 Debug - Está impersonando?', isImpersonating)
      
      // Se for admin e estiver impersonando, precisamos fazer a query de forma diferente
      // porque as políticas RLS podem estar bloqueando por tenant_id
      const query = supabase
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
          nao_respondeu,
          valor_fechado,
          observacao,
          created_at,
          pagou_sinal,
          valor_sinal,
          data_pagamento_sinal,
          venda_paga,
          data_pagamento_venda,
          data_lembrete_chamada,
          user_id,
          tenant_id
        `
        )
        .eq('user_id', effectiveUserId)
      
      // Se for admin impersonando, não filtrar por tenant_id (RLS já deve permitir)
      // Mas adicionar um log para debug
      if (isAdmin && isImpersonating) {
        console.log('🔍 Debug - Admin visualizando cliente de outro usuário')
        // Verificar tenant_id do usuário sendo visualizado
        const { data: targetUserProfile } = await supabase
          .from('user_profiles')
          .select('tenant_id, full_name, role')
          .eq('id', effectiveUserId)
          .single()
        
        // Buscar nome do tenant se houver
        if (targetUserProfile?.tenant_id) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', targetUserProfile.tenant_id)
            .single()
          console.log('🔍 Debug - Perfil do usuário sendo visualizado:', {
            ...targetUserProfile,
            tenant_name: tenant?.name
          })
        } else {
          console.log('🔍 Debug - Perfil do usuário sendo visualizado:', targetUserProfile)
        }
      }
      
      const { data: clientesData, error } = await query
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)
      
      // Debug adicional: contar total de clientes do usuário
      const countQuery = supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
      
      const { count: totalClientes } = await countQuery
      
      console.log('🔍 Debug - Total de clientes do usuário:', totalClientes)
      console.log('🔍 Debug - Clientes retornados pela query:', clientesData?.length || 0)

      if (error) {
        console.error('❌ Erro ao carregar clientes:', error)
        console.error('Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          effectiveUserId: effectiveUserId,
          currentUserId: user.id
        })
        
        // Se for erro de RLS/permissão, mostrar mensagem mais clara
        if (error.code === 'PGRST116' || error.message?.includes('row-level security')) {
          console.error('⚠️ ERRO DE RLS: As políticas RLS não foram configuradas. Execute admin-setup.sql no Supabase!')
        }
        
        setHasMore(false)
        setClientes([]) // Garantir que lista fica vazia em caso de erro
        clearTimeout(timeoutId)
        setLoading(false)
        return
      }

      console.log('✅ Clientes carregados:', clientesData?.length || 0)
      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)

      setClientes(transformados)
      setHasMore(((clientesData?.length ?? 0) === PAGE_SIZE))
      setPage(1)
      
      // Carregar estatísticas em paralelo para não bloquear a UI
      carregarEstatisticas().catch(error => {
        console.warn('⚠️ Erro ao carregar estatísticas (não crítico):', error)
      })
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar clientes:', error)
      setClientes([])
      setHasMore(false)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
      console.log('✅ Carregamento de clientes finalizado')
    }
  }, [carregarEstatisticas, formatarCliente, targetUserId])

  const carregarMaisClientes = useCallback(async () => {
    if (loadingMais || !hasMore) return

    setLoadingMais(true)
    try {
      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setHasMore(false)
        return
      }

      // Usar targetUserId se fornecido, senão usar o user.id
      const effectiveUserId = targetUserId || user.id

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
          nao_respondeu,
          valor_fechado,
          observacao,
          created_at,
          pagou_sinal,
          valor_sinal,
          data_pagamento_sinal,
          venda_paga,
          data_pagamento_venda,
          data_lembrete_chamada
        `
        )
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) {
        console.error('Erro ao carregar mais clientes:', error)
        setHasMore(false)
        return
      }

      const transformados = ((clientesData as ClienteSupabaseRow[] | null) ?? []).map(formatarCliente)

      // Filtrar duplicatas antes de adicionar
      setClientes((prev) => {
        const existingIds = new Set(prev.map(c => c.id))
        const novos = transformados.filter(c => !existingIds.has(c.id))
        return [...prev, ...novos]
      })
      setHasMore(((clientesData?.length ?? 0) === PAGE_SIZE))
      setPage((prev) => prev + 1)
    } catch (error) {
      console.error('Erro ao carregar mais clientes:', error)
    } finally {
      setLoadingMais(false)
    }
  }, [formatarCliente, hasMore, loadingMais, page, targetUserId])

  useEffect(() => {
    console.log('🚀 Hook useClientes inicializado, carregando clientes...')
    // Resetar paginação quando targetUserId mudar
    setPage(0)
    setClientes([])
    setHasMore(true)
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
      const valorSinalNumero = parseCurrencyInput(novoCliente.valorSinal ?? null)

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
          nao_respondeu: novoCliente.naoRespondeu || false,
          valor_fechado: valorFechadoNumero,
          observacao: novoCliente.observacao || null,
          pagou_sinal: novoCliente.pagouSinal || false,
          valor_sinal: valorSinalNumero,
          data_pagamento_sinal: novoCliente.dataPagamentoSinal || null,
          venda_paga: novoCliente.vendaPaga || false,
          data_pagamento_venda: novoCliente.dataPagamentoVenda || null,
          data_lembrete_chamada: novoCliente.dataLembreteChamada || null,
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
        nao_respondeu?: boolean
        valor_fechado?: number | null
        observacao?: string | null
        pagou_sinal?: boolean
        valor_sinal?: number | null
        data_pagamento_sinal?: string | null
        venda_paga?: boolean
        data_pagamento_venda?: string | null
        data_lembrete_chamada?: string | null
      }

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
      // Novos campos de pagamento
      if (dadosAtualizados.pagouSinal !== undefined) updateData.pagou_sinal = dadosAtualizados.pagouSinal
      if (dadosAtualizados.valorSinal !== undefined) {
        updateData.valor_sinal = parseCurrencyInput(dadosAtualizados.valorSinal)
      }
      if (dadosAtualizados.dataPagamentoSinal !== undefined) updateData.data_pagamento_sinal = dadosAtualizados.dataPagamentoSinal || null
      if (dadosAtualizados.vendaPaga !== undefined) updateData.venda_paga = dadosAtualizados.vendaPaga
      if (dadosAtualizados.dataPagamentoVenda !== undefined) updateData.data_pagamento_venda = dadosAtualizados.dataPagamentoVenda || null
      // Campo de notificação
      if (dadosAtualizados.dataLembreteChamada !== undefined) updateData.data_lembrete_chamada = dadosAtualizados.dataLembreteChamada || null

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
