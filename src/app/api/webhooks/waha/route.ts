import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getChatLabels } from '@/lib/waha'

interface WahaMessagePayload {
  from: string
  fromMe: boolean
  timestamp: number
  _data?: { notifyName?: string }
}

interface WahaLabelChatPayload {
  labelId: string
  chatId: string
}

interface WahaWebhookBody {
  event: string
  session: string
  payload: WahaMessagePayload | WahaLabelChatPayload
}

function getSessionUserMap(): Record<string, string> {
  const raw = process.env.WAHA_SESSION_USER_MAP
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function formatDateFromTimestamp(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000)
  return date.toISOString().split('T')[0]
}

async function resolveJidToPhone(session: string, jid: string): Promise<string | null> {
  if (jid.endsWith('@c.us')) {
    return jid.replace('@c.us', '')
  }
  if (!jid.endsWith('@lid')) return null

  const baseUrl = process.env.WAHA_API_URL
  const apiKey = process.env.WAHA_API_KEY
  if (!baseUrl || !apiKey) return null

  try {
    const res = await fetch(`${baseUrl}/api/${encodeURIComponent(session)}/lids/${encodeURIComponent(jid)}`, {
      headers: { 'X-Api-Key': apiKey },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { pn?: string }
    if (!data.pn?.endsWith('@c.us')) return null
    return data.pn.replace('@c.us', '')
  } catch {
    return null
  }
}

async function resolveUserId(
  supabase: ReturnType<typeof createAdminClient>,
  session: string
): Promise<{ userId: string | null; sessionRow: { user_id: string } | null }> {
  const { data: sessionRow } = await supabase
    .from('whatsapp_sessions')
    .select('user_id')
    .eq('session_name', session)
    .maybeSingle()

  const userId = sessionRow?.user_id ?? getSessionUserMap()[session] ?? null
  return { userId, sessionRow }
}

async function handleMessage(
  supabase: ReturnType<typeof createAdminClient>,
  session: string,
  payload: WahaMessagePayload
): Promise<NextResponse> {
  if (!payload || payload.fromMe || !payload.from) {
    return NextResponse.json({ ignored: true })
  }

  const whatsapp = await resolveJidToPhone(session, payload.from)
  if (!whatsapp) {
    return NextResponse.json({ ignored: true })
  }

  const { userId, sessionRow } = await resolveUserId(supabase, session)
  if (!userId) {
    return NextResponse.json({ ignored: true, reason: 'sessão não mapeada' })
  }

  if (sessionRow) {
    await supabase
      .from('whatsapp_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('session_name', session)
  }

  const nome = payload._data?.notifyName?.trim() || whatsapp

  const { data, error } = await supabase.rpc('create_lead_dedup', {
    p_user_id: userId,
    p_data_contato: formatDateFromTimestamp(payload.timestamp),
    p_nome: nome,
    p_identificador: whatsapp,
    p_origem: 'Anúncio',
    p_created_by: userId,
  })

  if (error) {
    console.error('Erro ao criar lead via webhook WAHA:', error)
    return NextResponse.json({ error: 'Erro ao criar lead' }, { status: 500 })
  }

  if (!data?.[0]?.created) {
    return NextResponse.json({ ignored: true, reason: 'lead já existe' })
  }

  return NextResponse.json({ ok: true })
}

async function handleLabelChange(
  supabase: ReturnType<typeof createAdminClient>,
  session: string,
  payload: WahaLabelChatPayload
): Promise<NextResponse> {
  if (!payload?.chatId) {
    return NextResponse.json({ ignored: true })
  }

  const whatsapp = await resolveJidToPhone(session, payload.chatId)
  if (!whatsapp) {
    return NextResponse.json({ ignored: true })
  }

  const { userId } = await resolveUserId(supabase, session)
  if (!userId) {
    return NextResponse.json({ ignored: true, reason: 'sessão não mapeada' })
  }

  let labels: { name: string }[]
  try {
    labels = await getChatLabels(session, payload.chatId)
  } catch (err) {
    console.error('Erro ao buscar etiquetas do chat WAHA:', err)
    return NextResponse.json({ error: 'Erro ao buscar etiquetas' }, { status: 500 })
  }

  const categoria = labels.map((l) => l.name).join(', ') || null

  const { error } = await supabase
    .from('clientes')
    .update({ categoria, updated_by: userId })
    .eq('user_id', userId)
    .eq('whatsapp_instagram', whatsapp)

  if (error) {
    console.error('Erro ao atualizar categoria via etiqueta WAHA:', error)
    return NextResponse.json({ error: 'Erro ao atualizar categoria' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-waha-secret')
  if (!process.env.WAHA_WEBHOOK_SECRET || secret !== process.env.WAHA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = (await request.json()) as WahaWebhookBody
  const supabase = createAdminClient()

  if (body.event === 'message') {
    return handleMessage(supabase, body.session, body.payload as WahaMessagePayload)
  }

  if (body.event === 'label.chat.added' || body.event === 'label.chat.deleted') {
    return handleLabelChange(supabase, body.session, body.payload as WahaLabelChatPayload)
  }

  return NextResponse.json({ ignored: true })
}
