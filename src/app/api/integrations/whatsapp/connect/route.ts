import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createSession, restartSession, getSession, getQrCodeDataUrl } from '@/lib/waha'

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

  const { data: existing } = await admin
    .from('whatsapp_sessions')
    .select('session_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const sessionName = existing?.session_name ?? `prizely-${user.id}`

  if (!existing) {
    await createSession(sessionName)
    await admin.from('whatsapp_sessions').insert({ user_id: user.id, session_name: sessionName, status: 'pending' })
  } else {
    const session = await getSession(sessionName)
    if (!session || session.status === 'STOPPED' || session.status === 'FAILED') {
      await restartSession(sessionName)
    }
  }

  const session = await getSession(sessionName)
  if (session?.status === 'WORKING') {
    await admin
      .from('whatsapp_sessions')
      .update({ status: 'connected', phone_number: session.me?.id ?? null, connected_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ status: 'connected', phone: session.me?.id ?? null })
  }

  const qr = await getQrCodeDataUrl(sessionName)
  return NextResponse.json({ status: 'qr', qr })
}
