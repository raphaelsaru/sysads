import { describe, expect, it } from 'vitest'
import { extrairCamposDiagnostico } from './waha-diagnostico'

describe('extrairCamposDiagnostico', () => {
  it('captura nomes e dados de anúncio em qualquer profundidade, sem texto da conversa', () => {
    const payload = {
      id: 'false_123@c.us_ABC',
      body: 'texto privado',
      _data: {
        pushName: 'Maria',
        message: {
          conversation: 'texto privado',
          extendedTextMessage: {
            text: 'texto privado',
            contextInfo: {
              externalAdReply: { ctwaClid: 'clid-1', sourceId: 'ad-9', sourceUrl: 'https://fb.me/x', title: 'Promo' },
            },
          },
        },
      },
    }

    const r = extrairCamposDiagnostico(payload)

    expect(r.chavesPayload).toEqual(['id', 'body', '_data'])
    expect(r.chavesData).toEqual(['pushName', 'message'])
    expect(r.campos).toEqual({
      '_data.pushName': 'Maria',
      '_data.message.extendedTextMessage.contextInfo.externalAdReply.ctwaClid': 'clid-1',
      '_data.message.extendedTextMessage.contextInfo.externalAdReply.sourceId': 'ad-9',
      '_data.message.extendedTextMessage.contextInfo.externalAdReply.sourceUrl': 'https://fb.me/x',
    })
    expect(JSON.stringify(r)).not.toContain('texto privado')
  })

  it('aguenta payload vazio ou estranho', () => {
    expect(extrairCamposDiagnostico(null)).toEqual({ chavesPayload: [], chavesData: [], campos: {} })
    expect(extrairCamposDiagnostico({ _data: 'x' }).chavesData).toEqual([])
  })
})
