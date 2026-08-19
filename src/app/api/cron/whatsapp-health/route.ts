import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getSession, sendText } from '@/lib/waha'

const ALERT_SESSION = 'default'
const ALERT_CHAT_ID = process.env.ALERT_WHATSAPP_TO ?? '5511991753582@c.us'
const STALE_HOURS = 72
const ALERT_COOLDOWN_HOURS = 20

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: rows } = await supabase
    .from('whatsapp_sessions')
    .select('user_id, session_name, status, last_message_at, connected_at, last_alert_at')
    .in('status', ['connected', 'failed'])

  const results: { session: string; event: string }[] = []

  for (const row of rows ?? []) {
    const session = await getSession(row.session_name)
    const working = session?.status === 'WORKING'
    const referenceTime = row.last_message_at ?? row.connected_at
    const staleMs = referenceTime ? Date.now() - new Date(referenceTime).getTime() : 0
    const isStale = working && staleMs > STALE_HOURS * 60 * 60 * 1000
    const isDown = !working || isStale

    if (!isDown) {
      if (row.status === 'failed') {
        await supabase
          .from('whatsapp_sessions')
          .update({ status: 'connected', last_alert_at: null })
          .eq('user_id', row.user_id)
        await sendText(
          ALERT_SESSION,
          ALERT_CHAT_ID,
          `✅ WhatsApp reconectado no Prizely\n\nSessão: ${row.session_name}`
        )
        results.push({ session: row.session_name, event: 'recovered' })
      } else {
        results.push({ session: row.session_name, event: 'ok' })
      }
      continue
    }

    if (row.status !== 'failed') {
      await supabase.from('whatsapp_sessions').update({ status: 'failed' }).eq('user_id', row.user_id)
    }

    const cooldownOk =
      !row.last_alert_at || Date.now() - new Date(row.last_alert_at).getTime() > ALERT_COOLDOWN_HOURS * 60 * 60 * 1000

    if (cooldownOk) {
      const reason = isStale ? `sem mensagens há mais de ${STALE_HOURS}h (status ainda mostra conectado)` : `status ${session?.status ?? 'sem resposta'}`
      await sendText(
        ALERT_SESSION,
        ALERT_CHAT_ID,
        `⚠️ WhatsApp desconectado no Prizely\n\nSessão: ${row.session_name}\nMotivo: ${reason}\n\nPeça pro usuário reconectar em /settings/integrations.`
      )
      await supabase.from('whatsapp_sessions').update({ last_alert_at: new Date().toISOString() }).eq('user_id', row.user_id)
      results.push({ session: row.session_name, event: 'alerted' })
    } else {
      results.push({ session: row.session_name, event: 'down_cooldown' })
    }
  }

  return NextResponse.json({ checked: results.length, results })
}
