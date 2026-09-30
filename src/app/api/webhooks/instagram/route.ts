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
  let hasGenuineFailure = false
  let ignoradoInativo = false

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
      const dataContato = new Date(event.timestamp).toISOString().split('T')[0]

      const { data, error } = await supabase
        .rpc('find_or_create_cliente', {
          p_user_id: account.user_id,
          p_data_contato: dataContato,
          p_nome: username ?? identificador,
          p_identificador: identificador,
          p_origem: 'Instagram',
          p_created_by: account.user_id,
        })
        .single()

      // Usuário/empresa desativados: ignora (sem 500) p/ a Meta parar de reentregar.
      if (error?.message?.includes('usuario sem empresa ativa')) {
        console.warn('Webhook Instagram ignorado: usuário sem empresa ativa', account.user_id)
        ignoradoInativo = true
        continue
      }

      if (error || !data) {
        console.error('Erro ao criar/encontrar cliente via webhook Instagram:', error)
        hasGenuineFailure = true
        continue
      }

      const { id: clienteId } = data as { id: string; created: boolean }

      // Sempre registra uma negociação nova pro evento, mesmo quando o cliente já
      // existia (created:false) — mesma correção da Task 5.1 (WAHA): um lead
      // recorrente não gerava nenhum registro do novo contato.
      //
      // Instagram (Meta Graph API) também reentrega o mesmo webhook em caso de
      // timeout/resposta não-2xx. message.mid é o id da mensagem, campo padrão
      // documentado nos webhooks de Messenger/Instagram da Meta — reusa
      // origem_evento_id (mesma coluna/índice único parcial da Task 5.1, não é
      // específico do WAHA) pra tornar esse insert idempotente: uma reentrega
      // com o mesmo mid colide (23505) e é tratada como no-op.
      const origemEventoId = event.message.mid ?? null

      const { error: negociacaoError } = await supabase.from('negociacoes').insert({
        cliente_id: clienteId,
        data_contato: dataContato,
        created_by: account.user_id,
        updated_by: account.user_id,
        origem_evento_id: origemEventoId,
      })

      if (negociacaoError) {
        if (negociacaoError.code === '23505' && origemEventoId) {
          console.warn('Negociação duplicada ignorada (evento Instagram já processado):', origemEventoId)
          continue
        }
        console.error('Erro ao criar negociação via webhook Instagram:', negociacaoError)
        hasGenuineFailure = true
      }
    }
  }

  if (hasGenuineFailure) {
    return NextResponse.json({ error: 'Erro ao processar webhook Instagram' }, { status: 500 })
  }

  if (ignoradoInativo) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'usuario_inativo' })
  }

  return NextResponse.json({ ok: true })
}
