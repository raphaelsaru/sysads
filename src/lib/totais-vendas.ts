// Agrega as vendas de cada cliente (cards de /clientes): total vendido e situação de pagamento.

export type LinhaVenda = {
  cliente_id: string
  resultado: string
  valor_fechado: number | string | null
  venda_paga: boolean | null
  pagou_sinal: boolean | null
}

export type Pagamento = 'pago' | 'parcial' | 'a_receber'

export type TotalCliente = { total: number; vendas: number; pagamento: Pagamento }

export function totaisDeVendas(linhas: LinhaVenda[]): Record<string, TotalCliente> {
  const acc: Record<string, { total: number; vendas: number; pagas: number; comSinal: number }> = {}
  for (const l of linhas) {
    if (l.resultado !== 'Venda') continue
    const a = (acc[l.cliente_id] ??= { total: 0, vendas: 0, pagas: 0, comSinal: 0 })
    a.total += Number(l.valor_fechado) || 0
    a.vendas += 1
    if (l.venda_paga) a.pagas += 1
    else if (l.pagou_sinal) a.comSinal += 1
  }

  const resultado: Record<string, TotalCliente> = {}
  for (const [id, a] of Object.entries(acc)) {
    const pagamento: Pagamento =
      a.pagas === a.vendas ? 'pago' : a.pagas > 0 || a.comSinal > 0 ? 'parcial' : 'a_receber'
    resultado[id] = { total: a.total, vendas: a.vendas, pagamento }
  }
  return resultado
}
