import { describe, expect, it } from 'vitest'
import { nomeDoContato, telefoneAlternativo } from './waha-payload'

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

describe('telefoneAlternativo', () => {
  it('NOWEB em modo LID traz o telefone em _data.key', () => {
    expect(telefoneAlternativo({ _data: { key: { remoteJid: '123@lid', remoteJidAlt: '5511999998888@s.whatsapp.net' } } })).toBe('5511999998888')
    expect(telefoneAlternativo({ _data: { key: { senderPn: '5511999997777@s.whatsapp.net' } } })).toBe('5511999997777')
    expect(telefoneAlternativo({ _data: { key: { remoteJidAlt: '5511999996666@c.us' } } })).toBe('5511999996666')
  })
  it('sem campo ou jid não-telefone → null', () => {
    expect(telefoneAlternativo({ _data: { key: { remoteJidAlt: '123@lid' } } })).toBeNull()
    expect(telefoneAlternativo({ _data: { key: { remoteJid: '123@g.us' } } })).toBeNull()
    expect(telefoneAlternativo({})).toBeNull()
  })
})
