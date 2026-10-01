import type { createAdminClient } from '@/lib/supabase-admin'
import {
  IDADE_MAXIMA_MS, MAX_TENTATIVAS, enviarEvento, montarEvento, proximaTentativa, type MetaEventName,
} from '@/lib/meta-capi'

type Admin = ReturnType<typeof createAdminClient>

type LinhaOutbox = {
  id: string
  tenant_id: string
  event_name: MetaEventName
  event_id: string
  entity_id: string
  event_time: string
  payload: { value?: number } | null
  attempts: number
}

type NegociacaoEnvio = {
  meta_sender_id: string | null
  meta_ig_account_id: string | null
  fbc: string | null
  fbp: string | null
  clientes: { id: string; telefone_normalizado: string | null; email: string | null } | null
}

type Config = { datasetId: string; token: string; testEventCode: string | null; currency: string }

export async function carregarConfigMeta(admin: Admin, tenantId: string): Promise<Config | null> {
  const [{ data: integ }, { data: token }, { data: dono }] = await Promise.all([
    admin.from('meta_integrations').select('dataset_id, test_event_code').eq('tenant_id', tenantId).maybeSingle(),
    admin.rpc('meta_ler_token', { p_tenant: tenantId }),
    admin.from('user_profiles').select('currency')
      .eq('tenant_id', tenantId).eq('role', 'owner').limit(1).maybeSingle(),
  ])
  if (!integ || !token) return null
  return {
    datasetId: integ.dataset_id,
    token: token as string,
    testEventCode: integ.test_event_code,
    currency: dono?.currency ?? 'BRL',
  }
}

// Envia um lote da outbox (claim atômico via RPC; só tenants com integração ativa).
export async function processarOutbox(admin: Admin, limit = 50) {
  const { data, error } = await admin.rpc('claim_meta_events', { p_limit: limit })
  if (error) throw new Error(`claim_meta_events: ${error.message}`)
  const linhas = (data ?? []) as LinhaOutbox[]
  const configs = new Map<string, Config | null>()
  const total = { enviados: 0, falhas: 0 }

  for (const l of linhas) {
    if (!configs.has(l.tenant_id)) configs.set(l.tenant_id, await carregarConfigMeta(admin, l.tenant_id))
    const cfg = configs.get(l.tenant_id)

    const falhar = async (erro: string, resposta: unknown = null, definitivo = false) => {
      const attempts = l.attempts + 1
      await admin.from('meta_event_outbox').update({
        status: definitivo || attempts >= MAX_TENTATIVAS ? 'failed' : 'pending',
        attempts,
        next_attempt_at: proximaTentativa(attempts).toISOString(),
        last_error: erro.slice(0, 500),
        meta_response: resposta,
      }).eq('id', l.id)
      total.falhas++
    }

    if (!cfg) { await falhar('integracao sem token'); continue }
    if (Date.now() - new Date(l.event_time).getTime() > IDADE_MAXIMA_MS) {
      await falhar('evento com mais de 7 dias', null, true)
      continue
    }

    const { data: negData } = await admin.from('negociacoes')
      .select('meta_sender_id, meta_ig_account_id, fbc, fbp, clientes(id, telefone_normalizado, email)')
      .eq('id', l.entity_id).eq('tenant_id', l.tenant_id).maybeSingle()
    const neg = negData as NegociacaoEnvio | null
    if (!neg?.clientes) { await falhar('negociacao removida', null, true); continue }

    const evento = montarEvento({
      eventName: l.event_name,
      eventId: l.event_id,
      eventTime: new Date(l.event_time),
      clienteId: neg.clientes.id,
      telefoneNormalizado: neg.clientes.telefone_normalizado,
      email: neg.clientes.email,
      igAccountId: neg.meta_ig_account_id,
      igSid: neg.meta_sender_id,
      fbc: neg.fbc,
      fbp: neg.fbp,
      value: l.payload?.value ?? null,
      currency: cfg.currency,
    })

    const r = await enviarEvento(cfg.datasetId, cfg.token, evento, cfg.testEventCode)
    if (r.ok) {
      await admin.from('meta_event_outbox').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempts: l.attempts + 1,
        meta_response: r.resposta,
        last_error: null,
      }).eq('id', l.id)
      total.enviados++
    } else {
      // log sem token/PII: só ids
      console.error('meta capi falhou', { outboxId: l.id, tenant: l.tenant_id, erro: r.erro })
      await falhar(r.erro, r.resposta)
    }
  }

  return { processados: linhas.length, ...total }
}
