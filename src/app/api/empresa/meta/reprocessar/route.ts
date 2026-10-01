import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { pode } from '@/lib/permissions'
import { escopoMeta } from '@/lib/meta-outbox'

// POST /api/empresa/meta/reprocessar { userId? } — volta eventos 'failed' do escopo p/ a fila.
export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !pode(caller.role, 'meta')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const admin = createAdminClient()
    const body = await request.json().catch(() => ({}))
    const escopo = await escopoMeta(admin, caller.tenantId, body.userId)
    if (!escopo) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })

    const query = admin.from('meta_event_outbox')
      .update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
      .eq('tenant_id', caller.tenantId).eq('status', 'failed')
    const { data, error } = await (escopo.userId ? query.eq('user_id', escopo.userId) : query).select('id')
    if (error) return NextResponse.json({ error: 'Erro ao reprocessar' }, { status: 500 })

    return NextResponse.json({ reprocessados: data?.length ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
