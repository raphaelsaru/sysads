import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { escopoMeta } from '@/lib/meta-outbox'
import { isSuperadmin } from '@/lib/roles'

const STATUS = ['pending', 'processing', 'sent', 'failed'] as const

// GET /api/empresa/meta?userId= — config (sem token) + diagnóstico da outbox. Superadmin até homologar.
export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const tenantId = caller.tenantId
    const admin = createAdminClient()
    const escopo = await escopoMeta(admin, tenantId, request.nextUrl.searchParams.get('userId'))
    if (!escopo) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })

    const integQuery = admin.from('meta_integrations')
      .select('dataset_id, is_active, test_event_code, token_secret_id')
      .eq('tenant_id', tenantId)
    // Escopo usuário: só eventos dos leads dele; empresa: todos.
    const contar = (status: string) => {
      const q = admin.from('meta_event_outbox').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', status)
      return escopo.userId ? q.eq('user_id', escopo.userId) : q
    }
    const ultimos = admin.from('meta_event_outbox')
      .select('id, event_name, event_id, status, attempts, last_error, created_at, sent_at, meta_response')
      .eq('tenant_id', tenantId)

    const [{ data: integ }, contagens, { data: eventos }] = await Promise.all([
      (escopo.userId ? integQuery.eq('user_id', escopo.userId) : integQuery.is('user_id', null)).maybeSingle(),
      Promise.all(STATUS.map(contar)),
      (escopo.userId ? ultimos.eq('user_id', escopo.userId) : ultimos)
        .order('created_at', { ascending: false }).limit(20),
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

// PUT /api/empresa/meta { userId?, datasetId, token?, testEventCode?, isActive }
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
    const escopo = await escopoMeta(admin, tenantId, body.userId)
    if (!escopo) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })

    const atualQuery = admin.from('meta_integrations').select('id, token_secret_id').eq('tenant_id', tenantId)
    const { data: atual } = await (escopo.userId
      ? atualQuery.eq('user_id', escopo.userId)
      : atualQuery.is('user_id', null)).maybeSingle()
    if (isActive && !token && !atual?.token_secret_id) {
      return NextResponse.json({ error: 'Configure o token antes de ativar' }, { status: 400 })
    }

    const dados = {
      dataset_id: datasetId,
      test_event_code: testEventCode,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }
    const { data: salvo, error } = atual
      ? await admin.from('meta_integrations').update(dados).eq('id', atual.id).select('id').single()
      : await admin.from('meta_integrations')
        .insert({ ...dados, tenant_id: tenantId, user_id: escopo.userId }).select('id').single()
    if (error || !salvo) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })

    if (token) {
      const { error: tokenError } = await admin.rpc('meta_salvar_token', { p_integracao: salvo.id, p_token: token })
      if (tokenError) return NextResponse.json({ error: 'Erro ao salvar token' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
