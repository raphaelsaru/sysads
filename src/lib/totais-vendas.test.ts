import { describe, expect, it } from 'vitest'
import { totaisDeVendas } from './totais-vendas'

describe('totaisDeVendas', () => {
  it('soma só vendas por cliente', () => {
    const t = totaisDeVendas([
      { cliente_id: 'a', resultado: 'Venda', valor_fechado: 100, venda_paga: true, pagou_sinal: false },
      { cliente_id: 'a', resultado: 'Venda', valor_fechado: '50.5', venda_paga: true, pagou_sinal: false },
      { cliente_id: 'a', resultado: 'Não Venda', valor_fechado: 999, venda_paga: false, pagou_sinal: false },
      { cliente_id: 'b', resultado: 'Venda', valor_fechado: null, venda_paga: false, pagou_sinal: false },
    ])
    expect(t.a).toEqual({ total: 150.5, vendas: 2, pagamento: 'pago' })
    expect(t.b).toEqual({ total: 0, vendas: 1, pagamento: 'a_receber' })
  })

  it('parcial quando há sinal ou parte paga', () => {
    const t = totaisDeVendas([
      { cliente_id: 'a', resultado: 'Venda', valor_fechado: 10, venda_paga: true, pagou_sinal: false },
      { cliente_id: 'a', resultado: 'Venda', valor_fechado: 10, venda_paga: false, pagou_sinal: false },
      { cliente_id: 'b', resultado: 'Venda', valor_fechado: 10, venda_paga: false, pagou_sinal: true },
    ])
    expect(t.a.pagamento).toBe('parcial')
    expect(t.b.pagamento).toBe('parcial')
  })

  it('cliente sem venda não aparece', () => {
    const t = totaisDeVendas([
      { cliente_id: 'a', resultado: 'Orçamento em Processo', valor_fechado: 10, venda_paga: false, pagou_sinal: false },
    ])
    expect(t.a).toBeUndefined()
  })
})
