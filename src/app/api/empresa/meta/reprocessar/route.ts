import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'

// POST /api/empresa/meta/reprocessar — volta eventos 'failed' da empresa p/ a fila.
export async function POST() {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !isSuperadmin(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data, error } = await createAdminClient().from('meta_event_outbox')
      .update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
      .eq('tenant_id', caller.tenantId).eq('status', 'failed')
      .select('id')
    if (error) return NextResponse.json({ error: 'Erro ao reprocessar' }, { status: 500 })

    return NextResponse.json({ reprocessados: data?.length ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
