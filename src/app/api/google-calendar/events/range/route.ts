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
  const startMonth = url.searchParams.get('startMonth') // YYYY-MM
  const months = Math.min(Math.max(Number(url.searchParams.get('months') ?? '8'), 1), 12)

  const targetUserId = requestedUserId || user.id

  if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) {
    return NextResponse.json({ error: 'startMonth inválido, use YYYY-MM' }, { status: 400 })
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
    return NextResponse.json({ months: [] })
  }

  const [year, monthNum] = startMonth.split('-').map(Number)
  const timeMin = new Date(Date.UTC(year, monthNum - 1, 1))
  const timeMax = new Date(Date.UTC(year, monthNum - 1 + months, 1))

  try {
    const accessToken = await getValidAccessToken()
    const events = await listEvents(accessToken, mapping.calendar_id, timeMin, timeMax)

    const counts = new Map<string, number>()
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(year, monthNum - 1 + i, 1))
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      counts.set(key, 0)
    }

    for (const event of events) {
      const key = event.start.slice(0, 7)
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }

    const result = Array.from(counts.entries()).map(([month, count]) => ({ month, count }))
    return NextResponse.json({ months: result })
  } catch (error) {
    if (error instanceof GoogleCalendarNotConnectedError) {
      return NextResponse.json({ error: 'not_connected' }, { status: 409 })
    }
    console.error('Erro ao buscar resumo do Google Calendar:', error)
    return NextResponse.json({ error: 'Erro ao buscar resumo' }, { status: 502 })
  }
}
