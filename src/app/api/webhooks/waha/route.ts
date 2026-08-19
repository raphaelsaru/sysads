import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

interface WahaMessagePayload {
  from: string
  fromMe: boolean
  timestamp: number
  _data?: { notifyName?: string }
}

interface WahaWebhookBody {
  event: string
  session: string
  payload: WahaMessagePayload
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

async function resolveLidToPhone(session: string, lidJid: string): Promise<string | null> {
  const baseUrl = process.env.WAHA_API_URL
  const apiKey = process.env.WAHA_API_KEY
  if (!baseUrl || !apiKey) return null

  try {
    const res = await fetch(
      `${baseUrl}/api/contacts?session=${encodeURIComponent(session)}&contactId=${encodeURIComponent(lidJid)}`,
      { headers: { 'X-Api-Key': apiKey } }
    )
    if (!res.ok) return null
    const contact = (await res.json()) as { id?: string }
    if (!contact.id?.endsWith('@c.us')) return null
    return contact.id.replace('@c.us', '')
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-waha-secret')
  if (!process.env.WAHA_WEBHOOK_SECRET || secret !== process.env.WAHA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = (await request.json()) as WahaWebhookBody

  if (body.event !== 'message') {
    return NextResponse.json({ ignored: true })
  }

  const { payload, session } = body

  if (!payload || payload.fromMe || !payload.from) {
    return NextResponse.json({ ignored: true })
  }

  let whatsapp: string | null = null
  if (payload.from.endsWith('@c.us')) {
    whatsapp = payload.from.replace('@c.us', '')
  } else if (payload.from.endsWith('@lid')) {
    whatsapp = await resolveLidToPhone(session, payload.from)
  }

  if (!whatsapp) {
    return NextResponse.json({ ignored: true })
  }

  const supabase = createAdminClient()

  const { data: sessionRow } = await supabase
    .from('whatsapp_sessions')
    .select('user_id')
    .eq('session_name', session)
    .maybeSingle()

  const userId = sessionRow?.user_id ?? getSessionUserMap()[session]
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

  const { data: existentes } = await supabase
    .from('clientes')
    .select('id')
    .eq('user_id', userId)
    .eq('whatsapp_instagram', whatsapp)
    .limit(1)

  if (existentes && existentes.length > 0) {
    return NextResponse.json({ ignored: true, reason: 'lead já existe' })
  }

  const { error } = await supabase.from('clientes').insert({
    user_id: userId,
    data_contato: formatDateFromTimestamp(payload.timestamp),
    nome,
    whatsapp_instagram: whatsapp,
    origem: 'Anúncio',
    orcamento_enviado: false,
    resultado: 'Orçamento em Processo',
    qualidade_contato: 'Regular',
    nao_respondeu: false,
    created_by: userId,
    updated_by: userId,
  })

  if (error) {
    console.error('Erro ao criar lead via webhook WAHA:', error)
    return NextResponse.json({ error: 'Erro ao criar lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
