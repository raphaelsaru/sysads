import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_TENTATIVAS, enviarEvento, montarEvento, proximaTentativa, sha256, telefoneParaMeta,
} from './meta-capi'

describe('telefoneParaMeta', () => {
  it('BRL: prefixa 55 em número sem DDI', () => {
    expect(telefoneParaMeta('11999998888', 'BRL')).toBe('5511999998888')
    expect(telefoneParaMeta('1133334444', 'BRL')).toBe('551133334444')
  })
  it('USD: 10 dígitos ganham 1; 11 com 1 na frente ficam', () => {
    expect(telefoneParaMeta('5550104477', 'USD')).toBe('15550104477')
    expect(telefoneParaMeta('15550104477', 'USD')).toBe('15550104477')
  })
  it('outra moeda: só dígitos', () => expect(telefoneParaMeta('447911123456', 'EUR')).toBe('447911123456'))
  it('mantém número com mais de 11 dígitos', () => expect(telefoneParaMeta('14155552671000', 'BRL')).toBe('14155552671000'))
  it('nulo/curto vira null', () => {
    expect(telefoneParaMeta(null, 'BRL')).toBeNull()
    expect(telefoneParaMeta('12345', 'BRL')).toBeNull()
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

  it('telefone US usa DDI 1 quando moeda é USD', () => {
    const e = montarEvento({ ...base, telefoneNormalizado: '15550104477', currency: 'USD' })
    expect(e.user_data.ph).toEqual([sha256('15550104477')])
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

describe('enviarEvento', () => {
  afterEach(() => vi.unstubAllGlobals())
  const evento = montarEvento({
    eventName: 'Contact', eventId: 'x', eventTime: new Date(), clienteId: 'c', telefoneNormalizado: null,
    email: null, igAccountId: null, igSid: null, fbc: null, fbp: null, value: null, currency: 'BRL',
  })
  const responder = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))

  it('erro não transitório é definitivo e usa a mensagem amigável', async () => {
    responder(400, { error: { message: 'Invalid parameter', is_transient: false, error_user_msg: 'ig_sid inválido' } })
    const r = await enviarEvento('1', 't', evento)
    expect(r).toMatchObject({ ok: false, definitivo: true, erro: 'ig_sid inválido' })
  })

  it('erro transitório ou de rede tenta de novo', async () => {
    responder(500, { error: { message: 'Service unavailable', is_transient: true } })
    expect(await enviarEvento('1', 't', evento)).toMatchObject({ ok: false, definitivo: false })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))
    expect(await enviarEvento('1', 't', evento)).toMatchObject({ ok: false, definitivo: false })
  })
})
