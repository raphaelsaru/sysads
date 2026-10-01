import { describe, expect, it } from 'vitest'
import { MAX_TENTATIVAS, montarEvento, proximaTentativa, sha256, telefoneParaMeta } from './meta-capi'

describe('telefoneParaMeta', () => {
  it('prefixa 55 em número BR sem DDI', () => expect(telefoneParaMeta('11999998888')).toBe('5511999998888'))
  it('mantém número com mais de 11 dígitos', () => expect(telefoneParaMeta('14155552671000')).toBe('14155552671000'))
  it('nulo/curto vira null', () => {
    expect(telefoneParaMeta(null)).toBeNull()
    expect(telefoneParaMeta('12345')).toBeNull()
  })
})

describe('sha256', () => {
  it('hex minúsculo', () =>
    expect(sha256('a')).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'))
})

describe('montarEvento', () => {
  const base = {
    eventName: 'Purchase' as const,
    eventId: 'negociacao:n1:purchase',
    eventTime: new Date('2026-10-01T12:00:00Z'),
    clienteId: 'c1',
    telefoneNormalizado: '11999998888',
    email: ' Foo@Bar.com ',
    igAccountId: null,
    igSid: null,
    fbc: null,
    fbp: null,
    value: 2500,
    currency: 'BRL',
  }

  it('system_generated sem IG, com hashes e valor', () => {
    const e = montarEvento(base)
    expect(e.event_name).toBe('Purchase')
    expect(e.action_source).toBe('system_generated')
    expect(e.messaging_channel).toBeUndefined()
    expect(e.event_time).toBe(1790856000)
    expect(e.user_data.ph).toEqual([sha256('5511999998888')])
    expect(e.user_data.em).toEqual([sha256('foo@bar.com')])
    expect(e.user_data.external_id).toEqual([sha256('c1')])
    expect(e.custom_data).toEqual({ value: 2500, currency: 'BRL' })
  })

  it('mantém nomes padrão fora do IG', () => {
    expect(montarEvento({ ...base, eventName: 'Contact' }).event_name).toBe('Contact')
    expect(montarEvento({ ...base, eventName: 'Lead' }).event_name).toBe('Lead')
  })

  it('business_messaging com IG: ids sem hash e nomes de messaging', () => {
    const ig = { ...base, value: null, igAccountId: '17841', igSid: '999' }
    const e = montarEvento({ ...ig, eventName: 'Lead' })
    expect(e.action_source).toBe('business_messaging')
    expect(e.messaging_channel).toBe('instagram')
    expect(e.user_data.instagram_business_account_id).toBe('17841')
    expect(e.user_data.ig_sid).toBe('999')
    expect(e.custom_data).toBeUndefined()
    expect(e.event_name).toBe('QualifiedLead')
    expect(montarEvento({ ...ig, eventName: 'Contact' }).event_name).toBe('LeadSubmitted')
    expect(montarEvento({ ...ig, eventName: 'Purchase' }).event_name).toBe('Purchase')
  })

  it('omite campos ausentes', () => {
    const e = montarEvento({ ...base, telefoneNormalizado: null, email: null })
    expect(e.user_data.ph).toBeUndefined()
    expect(e.user_data.em).toBeUndefined()
  })
})

describe('proximaTentativa', () => {
  it('backoff exponencial em minutos, teto 6h', () => {
    const agora = new Date('2026-10-01T00:00:00Z')
    expect(proximaTentativa(1, agora).toISOString()).toBe('2026-10-01T00:02:00.000Z')
    expect(proximaTentativa(20, agora).toISOString()).toBe('2026-10-01T06:00:00.000Z')
  })
  it('MAX_TENTATIVAS = 8', () => expect(MAX_TENTATIVAS).toBe(8))
})
