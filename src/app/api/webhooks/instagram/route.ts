import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyWebhookSignature, getSenderUsername } from '@/lib/instagram'

interface InstagramMessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: { mid: string; text?: string; is_echo?: boolean }
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

      const { data: account } = await supabase
        .from('instagram_accounts')
        .select('user_id, access_token')
        .eq('ig_user_id', entry.id)
        .maybeSingle()

      if (!account) continue

      const username = await getSenderUsername(event.sender.id, account.access_token)
      const identificador = username ? `@${username}` : event.sender.id

      const { data: existentes } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', account.user_id)
        .eq('whatsapp_instagram', identificador)
        .limit(1)

      if (existentes && existentes.length > 0) continue

      await supabase.from('clientes').insert({
        user_id: account.user_id,
        data_contato: new Date(event.timestamp).toISOString().split('T')[0],
        nome: username ?? identificador,
        whatsapp_instagram: identificador,
        origem: 'Instagram',
        orcamento_enviado: false,
        resultado: 'Orçamento em Processo',
        qualidade_contato: 'Regular',
        nao_respondeu: false,
        created_by: account.user_id,
        updated_by: account.user_id,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
