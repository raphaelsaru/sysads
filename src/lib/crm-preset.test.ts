import { describe, expect, it } from 'vitest'
import { comValorAtual, opcoesCrm } from './crm-preset'

describe('opcoesCrm', () => {
  it('padrão não tem campos extras', () => {
    const o = opcoesCrm(null)
    expect(o.procedimentos).toEqual([])
    expect(o.motivosNaoVenda).toEqual([])
    expect(o.formasPagamentoSinal).toEqual([])
    expect(o.resultados).toEqual(['Venda', 'Orçamento em Processo', 'Não Venda'])
  })

  it('preset desconhecido cai no padrão', () => {
    expect(opcoesCrm('xyz')).toBe(opcoesCrm(undefined))
  })

  it('planilha tem campos extras e resultados novos', () => {
    const o = opcoesCrm('planilha')
    expect(o.procedimentos).toContain('Realismo Colorido')
    expect(o.motivosNaoVenda).toContain('Achou Caro')
    expect(o.formasPagamentoSinal).toContain('Pix')
    expect(o.resultados).toEqual(expect.arrayContaining(['Formulário', 'Consulta Presencial', 'Cancelado']))
    expect(o.origens).toContain('TikTok')
  })
})

describe('comValorAtual', () => {
  it('acrescenta valor fora da lista', () => {
    expect(comValorAtual(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
  })
  it('não duplica nem acrescenta vazio', () => {
    expect(comValorAtual(['a', 'b'], 'a')).toEqual(['a', 'b'])
    expect(comValorAtual(['a'], undefined)).toEqual(['a'])
  })
})
