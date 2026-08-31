import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getValidAccessToken, listCalendars, GoogleCalendarNotConnectedError } from '@/lib/google-calendar'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const accessToken = await getValidAccessToken()
    const calendars = await listCalendars(accessToken)
    return NextResponse.json({ calendars })
  } catch (error) {
    if (error instanceof GoogleCalendarNotConnectedError) {
      return NextResponse.json({ error: 'not_connected' }, { status: 409 })
    }
    console.error('Erro ao listar agendas do Google:', error)
    return NextResponse.json({ error: 'Erro ao listar agendas' }, { status: 500 })
  }
}
