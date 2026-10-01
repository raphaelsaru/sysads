import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getChatLabels } from '@/lib/waha'
import { extrairCamposDiagnostico } from '@/lib/waha-diagnostico'

interface WahaMessagePayload {
  // Id da mensagem WAHA, formato tipo whatsapp-web.js:
  // "{fromMe}_{remoteJid}_{msgId}" (ex: "false_5511999998888@c.us_3EB0...").
  // Não confirmado contra um servidor WAHA ao vivo neste ambiente — inferido
  // pela convenção documentada da API WAHA (que expõe o id serializado da
  // engine no campo `id` de nível superior do payload). Usado só como chave
  // de idempotência abaixo; se vier ausente/undefined, cai pra `null` e o
  // comportamento é o mesmo de antes (sem idempotência), não uma regressão.
  id?: string
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

  // Diagnóstico temporário (nome do contato / ctwa_clid); nunca bloqueia o lead.
  const { error: diagError } = await supabase
    .from('waha_diagnostico')
    .insert({ session, amostra: extrairCamposDiagnostico(payload) })
  if (diagError) console.warn('waha_diagnostico:', diagError.message)

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
  const dataContato = formatDateFromTimestamp(payload.timestamp)

  const { data, error } = await supabase
    .rpc('find_or_create_cliente', {
      p_user_id: userId,
      p_data_contato: dataContato,
      p_nome: nome,
      p_identificador: whatsapp,
      p_origem: 'Anúncio',
      p_created_by: userId,
    })
    .single()

  // Usuário/empresa desativados: 200 p/ o provedor parar de reentregar.
  if (error?.message?.includes('usuario sem empresa ativa')) {
    console.warn('Webhook WAHA ignorado: usuário sem empresa ativa', userId)
    return NextResponse.json({ ignored: true, reason: 'usuario_inativo' })
  }

  if (error || !data) {
    console.error('Erro ao criar/encontrar cliente via webhook WAHA:', error)
    return NextResponse.json({ error: 'Erro ao criar lead' }, { status: 500 })
  }

  const { id: clienteId, created } = data as { id: string; created: boolean }

  // Sempre registra uma negociação nova pro evento, mesmo quando o cliente já
  // existia (created:false) — corrige o bug em que um lead recorrente não
  // gerava nenhum registro do novo contato.
  //
  // WAHA pode reentregar o mesmo webhook em caso de timeout/resposta não-2xx.
  // origem_evento_id (id da mensagem WAHA) + índice único parcial em
  // negociacoes tornam esse insert idempotente: uma reentrega com o mesmo id
  // colide (23505) e é tratada como no-op, em vez de duplicar a negociação.
  const origemEventoId = payload.id ?? null

  const { error: negociacaoError } = await supabase.from('negociacoes').insert({
    cliente_id: clienteId,
    data_contato: dataContato,
    created_by: userId,
    updated_by: userId,
    origem_evento_id: origemEventoId,
  })

  if (negociacaoError) {
    if (negociacaoError.code === '23505' && origemEventoId) {
      console.warn('Negociação duplicada ignorada (evento WAHA já processado):', origemEventoId)
      return NextResponse.json({ ok: true, created, duplicate: true })
    }
    console.error('Erro ao criar negociação via webhook WAHA:', negociacaoError)
    return NextResponse.json({ error: 'Erro ao criar negociação' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, created })
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
