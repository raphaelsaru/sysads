import { describe, expect, it } from 'vitest'
import { nomeDoContato } from './waha-payload'

describe('nomeDoContato', () => {
  it('NOWEB manda pushName; WEBJS manda notifyName', () => {
    expect(nomeDoContato({ _data: { pushName: ' Felipe Augusto ' } })).toBe('Felipe Augusto')
    expect(nomeDoContato({ _data: { notifyName: 'Maria' } })).toBe('Maria')
  })
  it('sem nome ou vazio → null', () => {
    expect(nomeDoContato({ _data: { pushName: '  ' } })).toBeNull()
    expect(nomeDoContato({})).toBeNull()
  })
})
