import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Proxy fino para o serviço do assistente na VPS.
// Não é fronteira de segurança: a VPS revalida o access_token contra o
// Supabase e resolve o escopo por conta própria. Aqui só garantimos que o
// segredo compartilhado nunca chega ao browser.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // getSession() (e não getUser()) porque precisamos do access_token.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const url = process.env.ASSISTANT_AGENT_URL
    const secret = process.env.ASSISTANT_SHARED_SECRET
    if (!url || !secret) {
      return NextResponse.json({ erro: 'Assistente não configurado' }, { status: 503 })
    }

    const response = await fetch(`${url}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        'X-Prizely-Secret': secret,
      },
      body: JSON.stringify({
        pergunta: body?.pergunta,
        // Repassado como PEDIDO, não como fato — a VPS confere se é admin.
        impersonateUserId: body?.impersonateUserId,
        timezone: body?.timezone,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    // A resposta pode não ser JSON (ex.: página de erro HTML do Traefik).
    const texto = await response.text()
    let dados: unknown
    try {
      dados = JSON.parse(texto)
    } catch {
      console.error('Resposta não-JSON do assistente:', response.status, texto.slice(0, 500))
      return NextResponse.json({ erro: 'Resposta inválida do assistente' }, { status: 502 })
    }

    return NextResponse.json(dados, { status: response.status })
  } catch (error) {
    console.error('Erro no assistente:', error)
    return NextResponse.json({ erro: 'Assistente indisponível' }, { status: 502 })
  }
}
