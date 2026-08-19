import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { logoutSession } from '@/lib/waha'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('whatsapp_sessions')
    .select('session_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Nenhuma conexão encontrada' }, { status: 404 })
  }

  await logoutSession(row.session_name)
  await admin.from('whatsapp_sessions').update({ status: 'disconnected', phone_number: null }).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
