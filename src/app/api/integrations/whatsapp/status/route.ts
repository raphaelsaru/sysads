import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getSession, getQrCodeDataUrl } from '@/lib/waha'

export async function GET() {
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
    .select('session_name, status, phone_number')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ status: 'not_connected' })
  }

  const session = await getSession(row.session_name)

  if (session?.status === 'WORKING') {
    if (row.status !== 'connected') {
      await admin
        .from('whatsapp_sessions')
        .update({ status: 'connected', phone_number: session.me?.id ?? null, connected_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }
    return NextResponse.json({ status: 'connected', phone: session.me?.id ?? row.phone_number })
  }

  if (session?.status === 'SCAN_QR_CODE') {
    const qr = await getQrCodeDataUrl(row.session_name)
    return NextResponse.json({ status: 'qr', qr })
  }

  // Estados como STARTING (logo após escanear o QR, antes do engine sincronizar)
  // não significam falha — só ainda não terminou de conectar.
  if (session && session.status !== 'FAILED' && session.status !== 'STOPPED') {
    return NextResponse.json({ status: 'syncing' })
  }

  if (row.status !== 'disconnected' && row.status !== 'failed') {
    await admin.from('whatsapp_sessions').update({ status: 'failed' }).eq('user_id', user.id)
  }
  return NextResponse.json({ status: 'failed' })
}
