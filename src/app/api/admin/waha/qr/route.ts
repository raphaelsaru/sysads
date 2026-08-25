import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getSession, restartSession, getQrCodeDataUrl } from '@/lib/waha'

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !userProfile || userProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Preserva a config existente da sessão (não usa updateSessionConfig, que sobrescreveria
// o webhook com o do Prizely) — só reinicia com stop+start pra forçar novo QR.
export async function GET(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const sessionName = request.nextUrl.searchParams.get('sessionName')
  if (!sessionName) {
    return NextResponse.json({ error: 'sessionName obrigatório' }, { status: 400 })
  }

  let session = await getSession(sessionName).catch(() => null)

  if (session?.status !== 'SCAN_QR_CODE') {
    await restartSession(sessionName)

    for (let i = 0; i < 15; i++) {
      await sleep(2000)
      session = await getSession(sessionName).catch(() => null)
      if (session?.status === 'SCAN_QR_CODE' || session?.status === 'WORKING') break
    }
  }

  if (session?.status === 'WORKING') {
    return NextResponse.json({ status: 'WORKING', message: 'Sessão já conectada, sem necessidade de QR' })
  }

  if (session?.status !== 'SCAN_QR_CODE') {
    return NextResponse.json({ status: session?.status ?? 'desconhecido', error: 'QR ainda não disponível' }, { status: 202 })
  }

  const qr = await getQrCodeDataUrl(sessionName)
  return NextResponse.json({ status: 'SCAN_QR_CODE', qr })
}
