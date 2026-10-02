import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { podeVerAgenda } from '@/lib/agenda-acesso'
import { getValidAccessToken, listEvents, GoogleCalendarNotConnectedError } from '@/lib/google-calendar'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const requestedUserId = url.searchParams.get('userId')
  const month = url.searchParams.get('month') // YYYY-MM
  const targetUserId = requestedUserId || user.id

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month inválido, use YYYY-MM' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (!(await podeVerAgenda(admin, user.id, targetUserId))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { data: mapping } = await admin
    .from('google_calendar_mappings')
    .select('calendar_id')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (!mapping) {
    return NextResponse.json({ events: [] })
  }

  const [year, monthNum] = month.split('-').map(Number)
  const timeMin = new Date(Date.UTC(year, monthNum - 1, 1))
  const timeMax = new Date(Date.UTC(year, monthNum, 1))

  try {
    const accessToken = await getValidAccessToken()
    const events = await listEvents(accessToken, mapping.calendar_id, timeMin, timeMax)
    return NextResponse.json({ events })
  } catch (error) {
    if (error instanceof GoogleCalendarNotConnectedError) {
      return NextResponse.json({ error: 'not_connected' }, { status: 409 })
    }
    console.error('Erro ao buscar eventos do Google Calendar:', error)
    return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 502 })
  }
}
