'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { totaisDeVendas, type LinhaVenda, type TotalCliente } from '@/lib/totais-vendas'

const supabase = createClient()

// Total vendido + situação de pagamento por cliente (todas as vendas, não só a última).
// RLS escopa as negociações ao que o usuário pode ver.
export function useTotaisVendas(clienteIds: string[]) {
  const [totais, setTotais] = useState<Record<string, TotalCliente>>({})
  const chave = clienteIds.join(',')

  useEffect(() => {
    const ids = chave ? chave.split(',') : []
    if (ids.length === 0) {
      setTotais({})
      return
    }
    let cancelado = false
    supabase
      .from('negociacoes')
      .select('cliente_id, resultado, valor_fechado, venda_paga, pagou_sinal')
      .eq('resultado', 'Venda')
      .in('cliente_id', ids)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) {
          console.error('Erro ao carregar totais de vendas:', error)
          return
        }
        setTotais(totaisDeVendas((data ?? []) as LinhaVenda[]))
      })
    return () => { cancelado = true }
  }, [chave])

  return totais
}
