import { createHash } from 'node:crypto'

// Server-only: chamadas à Meta Conversions API. Token nunca vai ao browser.
export const META_GRAPH_VERSION = 'v26.0'
export const MAX_TENTATIVAS = 8
// Meta rejeita event_time com mais de 7 dias.
export const IDADE_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000

// Estágios internos do funil (meta_event_outbox.event_name).
export type MetaEventName = 'Contact' | 'Lead' | 'Purchase'

// business_messaging só aceita o vocabulário de messaging da Meta.
const NOME_MESSAGING: Record<MetaEventName, string> = {
  Contact: 'LeadSubmitted',
  Lead: 'QualifiedLead',
  Purchase: 'Purchase',
}

export type EventoMeta = {
  event_name: string
  event_time: number
  event_id: string
  action_source: 'business_messaging' | 'system_generated'
  messaging_channel?: 'instagram'
  user_data: {
    ph?: string[]
    em?: string[]
    external_id: string[]
    fbc?: string
    fbp?: string
    instagram_business_account_id?: string
    ig_sid?: string
  }
  custom_data?: { value: number; currency: string }
}

export type DadosEvento = {
  eventName: MetaEventName
  eventId: string
  eventTime: Date
  clienteId: string
  telefoneNormalizado: string | null
  email: string | null
  igAccountId: string | null
  igSid: string | null
  fbc: string | null
  fbp: string | null
  value: number | null
  currency: string
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

// Meta quer telefone com DDI. telefone_normalizado tira o 55 de números BR e não
// guarda país, então o DDI vem da moeda do dono do lead (BRL→55, USD→1).
// Sem isso, "11999998888" (SP) e "15550104477" (EUA) são indistinguíveis.
export function telefoneParaMeta(t: string | null, currency: string): string | null {
  const d = t?.replace(/\D/g, '') ?? ''
  if (d.length < 10) return null
  if (d.length > 11) return d
  if (currency === 'BRL') return `55${d}`
  if (currency === 'USD') return d.length === 10 ? `1${d}` : d
  return d
}

export function montarEvento(d: DadosEvento): EventoMeta {
  const ph = telefoneParaMeta(d.telefoneNormalizado, d.currency)
  const em = d.email?.trim().toLowerCase() || null
  const viaIg = !!(d.igAccountId && d.igSid)

  return {
    event_name: viaIg ? NOME_MESSAGING[d.eventName] : d.eventName,
    event_time: Math.floor(d.eventTime.getTime() / 1000),
    event_id: d.eventId,
    action_source: viaIg ? 'business_messaging' : 'system_generated',
    ...(viaIg && { messaging_channel: 'instagram' as const }),
    user_data: {
      ...(ph && { ph: [sha256(ph)] }),
      ...(em && { em: [sha256(em)] }),
      external_id: [sha256(d.clienteId)],
      ...(d.fbc && { fbc: d.fbc }),
      ...(d.fbp && { fbp: d.fbp }),
      // ids de conversa vão sem hash (hash quebra a atribuição)
      ...(viaIg && { instagram_business_account_id: d.igAccountId!, ig_sid: d.igSid! }),
    },
    ...(d.eventName === 'Purchase' && d.value != null && {
      custom_data: { value: d.value, currency: d.currency },
    }),
  }
}

export function proximaTentativa(tentativas: number, agora = new Date()): Date {
  const minutos = Math.min(2 ** tentativas, 360)
  return new Date(agora.getTime() + minutos * 60_000)
}

export type ResultadoEnvio =
  | { ok: true; resposta: unknown; fbtraceId: string | null }
  // definitivo: Meta disse que não adianta repetir (is_transient false), ex.: parâmetro inválido
  | { ok: false; erro: string; resposta: unknown; definitivo: boolean }

// Token vai no corpo (não na URL) p/ não vazar em logs.
export async function enviarEvento(
  datasetId: string, token: string, evento: EventoMeta, testEventCode?: string | null,
): Promise<ResultadoEnvio> {
  try {
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${datasetId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [evento],
        access_token: token,
        ...(testEventCode && { test_event_code: testEventCode }),
      }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      fbtrace_id?: string
      error?: { message?: string; fbtrace_id?: string; is_transient?: boolean; error_user_msg?: string }
    }
    if (!res.ok || json.error) {
      return {
        ok: false,
        erro: json.error?.error_user_msg ?? json.error?.message ?? `HTTP ${res.status}`,
        resposta: json,
        definitivo: json.error?.is_transient === false,
      }
    }
    return { ok: true, resposta: json, fbtraceId: json.fbtrace_id ?? null }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'erro de rede', resposta: null, definitivo: false }
  }
}
