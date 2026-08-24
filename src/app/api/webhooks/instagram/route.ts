import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyWebhookSignature, getSenderUsername } from '@/lib/instagram'

interface InstagramMessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: { mid: string; text?: string; is_echo?: boolean }
  referral?: { ad_id?: string; source?: string; type?: string }
}

interface InstagramWebhookBody {
  object: string
  entry: { id: string; time: number; messaging?: InstagramMessagingEvent[] }[]
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as InstagramWebhookBody
  if (body.object !== 'instagram') {
    return NextResponse.json({ ignored: true })
  }

  const supabase = createAdminClient()

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (!event.message || event.message.is_echo || !event.message.text) continue
      if (event.referral?.source !== 'ADS') continue

      const { data: account } = await supabase
        .from('instagram_accounts')
        .select('user_id, access_token')
        .eq('ig_user_id', entry.id)
        .maybeSingle()

      if (!account) continue

      const username = await getSenderUsername(event.sender.id, account.access_token)
      const identificador = username ? `@${username}` : event.sender.id

      const { error } = await supabase.rpc('create_lead_dedup', {
        p_user_id: account.user_id,
        p_data_contato: new Date(event.timestamp).toISOString().split('T')[0],
        p_nome: username ?? identificador,
        p_identificador: identificador,
        p_origem: 'Instagram',
        p_created_by: account.user_id,
      })

      if (error) {
        console.error('Erro ao criar lead via webhook Instagram:', error)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
