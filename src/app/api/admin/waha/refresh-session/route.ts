import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateSessionConfig, getSession } from '@/lib/waha'

export async function POST(request: NextRequest) {
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

  const { sessionName } = (await request.json()) as { sessionName?: string }
  if (!sessionName) {
    return NextResponse.json({ error: 'sessionName obrigatório' }, { status: 400 })
  }

  try {
    await updateSessionConfig(sessionName)
  } catch (err) {
    console.error('Erro ao atualizar config da sessão WAHA:', err)
    return NextResponse.json({ error: 'Falha ao atualizar sessão WAHA' }, { status: 500 })
  }

  const session = await getSession(sessionName).catch(() => null)

  return NextResponse.json({ ok: true, status: session?.status ?? 'desconhecido' })
}
