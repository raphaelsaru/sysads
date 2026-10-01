import { describe, expect, it } from 'vitest'
import { montarCardsEquipe } from './equipe'

const usuarios = [
  { id: 'a', full_name: 'Ana', email: 'a@x', role: 'user', is_active: true, currency: 'BRL' },
  { id: 'b', full_name: null, email: 'b@x', role: 'user', is_active: true, currency: 'USD' },
  { id: 'c', full_name: 'Caio', email: 'c@x', role: 'vendedor', is_active: true, currency: 'BRL' },
  { id: 'd', full_name: 'Dani', email: 'd@x', role: 'user', is_active: false, currency: 'BRL' },
  { id: 'e', full_name: 'Edu', email: 'e@x', role: 'owner', is_active: true, currency: 'BRL' },
]

describe('montarCardsEquipe', () => {
  it('só artistas ativos, com métricas e conversão', () => {
    const cards = montarCardsEquipe(usuarios, [
      { user_id: 'a', leads: 10, vendas: 3, valor_vendido: '1500.5' },
      { user_id: 'c', leads: 5, vendas: 5, valor_vendido: 100 },
    ])
    expect(cards.map(c => c.id)).toEqual(['a', 'b'])
    expect(cards[0]).toMatchObject({ nome: 'Ana', leads: 10, vendas: 3, valorVendido: 1500.5, conversao: 0.3 })
    expect(cards[1]).toMatchObject({ nome: 'b@x', leads: 0, vendas: 0, valorVendido: 0, conversao: null, currency: 'USD' })
  })

  it('ordena por valor vendido desc, depois nome', () => {
    const cards = montarCardsEquipe(
      [
        { id: 'x', full_name: 'Zé', email: null, role: 'user', is_active: true, currency: 'BRL' },
        { id: 'y', full_name: 'Bia', email: null, role: 'user', is_active: true, currency: 'BRL' },
        { id: 'z', full_name: 'Ana', email: null, role: 'user', is_active: true, currency: 'BRL' },
      ],
      [{ user_id: 'x', leads: 1, vendas: 1, valor_vendido: 10 }],
    )
    expect(cards.map(c => c.nome)).toEqual(['Zé', 'Ana', 'Bia'])
  })
})
