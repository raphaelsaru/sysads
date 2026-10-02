import { describe, expect, it } from 'vitest'
import { descreverEvento, type EventoAuditoria } from './auditoria'

const ev = (e: Partial<EventoAuditoria>): EventoAuditoria => ({
  tabela: 'clientes', operacao: 'UPDATE', rotulo: 'João Silva', mudancas: {}, ...e,
})

describe('descreverEvento', () => {
  it('lead criado/editado/excluído', () => {
    expect(descreverEvento(ev({ operacao: 'INSERT', mudancas: { nome: 'João Silva' } })).titulo).toBe('criou o lead João Silva')
    const ed = descreverEvento(ev({ mudancas: { nome: ['João', 'João Silva'], origem: ['Outro', 'Indicação'] } }))
    expect(ed.titulo).toBe('editou o lead João Silva')
    expect(ed.detalhes).toEqual(['Nome: João → João Silva', 'Origem: Outro → Indicação'])
    expect(descreverEvento(ev({ operacao: 'DELETE' })).titulo).toBe('excluiu o lead João Silva')
  })

  it('negociação formata moeda, booleano e data', () => {
    const d = descreverEvento(ev({
      tabela: 'negociacoes',
      mudancas: { valor_fechado: [500, 800], venda_paga: [false, true], data_pagamento_venda: [null, '2026-10-02'] },
    }))
    expect(d.titulo).toBe('editou a negociação de João Silva')
    expect(d.detalhes).toEqual([
      'Valor: R$ 500,00 → R$ 800,00',
      'Venda paga: Não → Sim',
      'Data do pagamento: — → 02/10/2026',
    ])
    expect(descreverEvento(ev({ tabela: 'negociacoes', operacao: 'INSERT', mudancas: { resultado: 'Venda', valor_fechado: 300 } })).detalhes)
      .toEqual(['Resultado: Venda', 'Valor: R$ 300,00'])
  })

  it('equipe: papel, ativação e responsável', () => {
    expect(descreverEvento(ev({ tabela: 'user_profiles', rotulo: 'Ana', mudancas: { role: ['user', 'vendedor'] } })))
      .toEqual({ titulo: 'alterou o usuário Ana', detalhes: ['Papel: Artista → Vendedor'] })
    expect(descreverEvento(ev({ tabela: 'user_profiles', rotulo: 'Ana', mudancas: { is_active: [true, false] } })).titulo)
      .toBe('desativou o usuário Ana')
    expect(descreverEvento(ev({ tabela: 'user_profiles', rotulo: 'Ana', mudancas: { is_active: [false, true] } })).titulo)
      .toBe('reativou o usuário Ana')
    expect(descreverEvento(ev({ mudancas: { user_id: ['u1', 'u2'] } }), { u1: 'Ana', u2: 'Bia' }).detalhes)
      .toEqual(['Responsável: Ana → Bia'])
  })

  it('vínculos e empresa', () => {
    expect(descreverEvento(ev({ tabela: 'vendedor_artistas', operacao: 'INSERT', rotulo: 'Vic → Ana' })).titulo)
      .toBe('vinculou vendedor e artista: Vic → Ana')
    expect(descreverEvento(ev({ tabela: 'vendedor_artistas', operacao: 'DELETE', rotulo: 'Vic → Ana' })).titulo)
      .toBe('desvinculou vendedor e artista: Vic → Ana')
    expect(descreverEvento(ev({ tabela: 'tenants', rotulo: 'Studio', mudancas: { branding: [{}, { primaryColor: '#fff' }] } })))
      .toEqual({ titulo: 'alterou os dados da empresa Studio', detalhes: ['Cores: alterada'] })
  })

  it('texto longo é cortado', () => {
    const d = descreverEvento(ev({ mudancas: { observacao: [null, 'x'.repeat(200)] } }))
    expect(d.detalhes[0].length).toBeLessThan(110)
  })
})
