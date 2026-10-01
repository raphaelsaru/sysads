import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'

const STATUS = ['pending', 'processing', 'sent', 'failed'] as const

// GET /api/empresa/meta — config (sem token) + diagnóstico da outbox. Superadmin até homologar.
export async function GET() {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const tenantId = caller.tenantId
    const admin = createAdminClient()

    const [{ data: integ }, contagens, { data: eventos }] = await Promise.all([
      admin.from('meta_integrations')
        .select('dataset_id, is_active, test_event_code, token_secret_id')
        .eq('tenant_id', tenantId).maybeSingle(),
      Promise.all(STATUS.map((s) => admin.from('meta_event_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', s))),
      admin.from('meta_event_outbox')
        .select('id, event_name, event_id, status, attempts, last_error, created_at, sent_at, meta_response')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    ])

    return NextResponse.json({
      integracao: integ ? {
        datasetId: integ.dataset_id,
        isActive: integ.is_active,
        testEventCode: integ.test_event_code,
        tokenConfigurado: !!integ.token_secret_id,
      } : null,
      contagem: Object.fromEntries(STATUS.map((s, i) => [s, contagens[i].count ?? 0])),
      eventos: (eventos ?? []).map(({ meta_response, ...e }) => ({
        ...e,
        fbtraceId: (meta_response as { fbtrace_id?: string } | null)?.fbtrace_id ?? null,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT /api/empresa/meta { datasetId, token?, testEventCode?, isActive }
export async function PUT(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const tenantId = caller.tenantId

    const body = await request.json().catch(() => ({}))
    const datasetId = typeof body.datasetId === 'string' ? body.datasetId.trim() : ''
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const testEventCode = typeof body.testEventCode === 'string' ? body.testEventCode.trim() || null : null
    const isActive = body.isActive === true

    if (!/^\d{5,25}$/.test(datasetId)) {
      return NextResponse.json({ error: 'Dataset ID inválido' }, { status: 400 })
    }
    if (token && token.length < 20) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: atual } = await admin.from('meta_integrations')
      .select('token_secret_id').eq('tenant_id', tenantId).maybeSingle()
    if (isActive && !token && !atual?.token_secret_id) {
      return NextResponse.json({ error: 'Configure o token antes de ativar' }, { status: 400 })
    }

    const { error } = await admin.from('meta_integrations').upsert({
      tenant_id: tenantId,
      dataset_id: datasetId,
      test_event_code: testEventCode,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })

    if (token) {
      const { error: tokenError } = await admin.rpc('meta_salvar_token', { p_tenant: tenantId, p_token: token })
      if (tokenError) return NextResponse.json({ error: 'Erro ao salvar token' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
