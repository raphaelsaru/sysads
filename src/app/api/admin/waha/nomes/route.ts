import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getContact } from '@/lib/waha'
import { extrairCamposDiagnostico } from '@/lib/waha-diagnostico'

// TEMPORÁRIA (01/10/2026): preenche nome de leads WhatsApp que ficaram com o número
// (bug pushName/NOWEB). Remover após rodar. Protegida pelo segredo do cron.
function autorizado(request: NextRequest) {
  const secret = process.env.META_CRON_SECRET
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`
}

async function pendentes(limit: number) {
  const admin = createAdminClient()
  const { data: sessoes } = await admin.from('whatsapp_sessions').select('user_id, session_name')
  const sessaoPorUser = new Map((sessoes ?? []).map((s) => [s.user_id as string, s.session_name as string]))
  const { data: clientes } = await admin.from('clientes')
    .select('id, user_id, nome, whatsapp_instagram')
    .in('user_id', [...sessaoPorUser.keys()])
    .filter('whatsapp_instagram', 'match', '^[0-9]{10,15}$')
    .limit(2000)
  const lista = (clientes ?? []).filter((c) => c.nome === c.whatsapp_instagram).slice(0, limit)
  return { admin, sessaoPorUser, lista }
}

const NOMES = ['name', 'pushname', 'pushName', 'notify', 'verifiedName', 'shortName'] as const

function nomeDoContatoWaha(contato: Record<string, unknown>): string | null {
  for (const k of NOMES) {
    const v = contato[k]
    if (typeof v === 'string' && v.trim() && !/^\+?[0-9 ]+$/.test(v.trim())) return v.trim()
  }
  return null
}

// GET ?amostra — formato da resposta p/ 1 contato (chaves + campos de nome)
export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { sessaoPorUser, lista } = await pendentes(1)
  const c = lista[0]
  if (!c) return NextResponse.json({ pendentes: 0 })
  const contato = await getContact(sessaoPorUser.get(c.user_id)!, `${c.whatsapp_instagram}@c.us`)
  return NextResponse.json({
    encontrado: !!contato,
    chaves: contato ? Object.keys(contato) : [],
    campos: contato ? extrairCamposDiagnostico(contato).campos : {},
  })
}

// POST ?limit=N — preenche um lote
export async function POST(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 500)
  const { admin, sessaoPorUser, lista } = await pendentes(limit)
  let atualizados = 0
  let semNome = 0
  for (const c of lista) {
    const contato = await getContact(sessaoPorUser.get(c.user_id)!, `${c.whatsapp_instagram}@c.us`)
    const nome = contato ? nomeDoContatoWaha(contato) : null
    if (!nome) { semNome++; continue }
    const { error } = await admin.from('clientes').update({ nome })
      .eq('id', c.id).eq('nome', c.whatsapp_instagram)
    if (!error) atualizados++
  }
  return NextResponse.json({ processados: lista.length, atualizados, semNome })
}
