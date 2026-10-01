import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { carregarConfigMeta } from '@/lib/meta-outbox'
import { enviarEvento, montarEvento } from '@/lib/meta-capi'

// POST /api/empresa/meta/testar — envia um Contact de teste (exige test_event_code). Não usa a outbox.
export async function POST() {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const cfg = await carregarConfigMeta(createAdminClient(), caller.tenantId)
    if (!cfg) return NextResponse.json({ error: 'Configure dataset e token' }, { status: 400 })
    if (!cfg.testEventCode) return NextResponse.json({ error: 'Preencha o test event code' }, { status: 400 })

    const evento = montarEvento({
      eventName: 'Contact',
      eventId: `teste:${Date.now()}`,
      eventTime: new Date(),
      clienteId: caller.tenantId,
      telefoneNormalizado: null,
      email: null,
      igAccountId: null,
      igSid: null,
      fbc: null,
      fbp: null,
      value: null,
      currency: cfg.currency,
    })
    const r = await enviarEvento(cfg.datasetId, cfg.token, evento, cfg.testEventCode)
    return NextResponse.json(r.ok ? { ok: true, fbtraceId: r.fbtraceId } : { ok: false, erro: r.erro })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
