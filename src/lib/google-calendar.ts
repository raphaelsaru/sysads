import { createAdminClient } from '@/lib/supabase-admin'

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email'

function assertConfigured(): void {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('GOOGLE_CALENDAR_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI não configurados')
  }
}

export function authorizeUrl(state: string): string {
  assertConfigured()
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  assertConfigured()
  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    redirect_uri: REDIRECT_URI!,
    grant_type: 'authorization_code',
    code,
  })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
  if (!res.ok) throw new Error(`Falha ao trocar code por token: ${res.status}`)
  return res.json()
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  assertConfigured()
  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
  if (!res.ok) throw new Error(`Falha ao renovar token do Google: ${res.status}`)
  return res.json()
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Falha ao buscar email do Google: ${res.status}`)
  const data = (await res.json()) as { email: string }
  return data.email
}

export class GoogleCalendarNotConnectedError extends Error {
  constructor() {
    super('Conexão com Google Calendar não configurada')
    this.name = 'GoogleCalendarNotConnectedError'
  }
}

export async function getValidAccessToken(): Promise<string> {
  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('google_calendar_connections')
    .select('id, access_token, refresh_token, expiry_date')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection) throw new GoogleCalendarNotConnectedError()

  const expiresAt = new Date(connection.expiry_date).getTime()
  if (expiresAt - Date.now() > 60_000) {
    return connection.access_token
  }

  const refreshed = await refreshAccessToken(connection.refresh_token)
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await admin
    .from('google_calendar_connections')
    .update({
      access_token: refreshed.access_token,
      expiry_date: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  return refreshed.access_token
}

export interface GoogleCalendarSummary {
  id: string
  summary: string
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendarSummary[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Falha ao listar agendas: ${res.status}`)
  const data = (await res.json()) as { items?: { id: string; summary: string }[] }
  return (data.items ?? []).map((item) => ({ id: item.id, summary: item.summary }))
}

export interface GoogleCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Falha ao buscar eventos: ${res.status}`)
  const data = (await res.json()) as {
    items?: {
      id: string
      summary?: string
      start?: { date?: string; dateTime?: string }
      end?: { date?: string; dateTime?: string }
    }[]
  }
  return (data.items ?? []).map((item) => {
    const allDay = Boolean(item.start?.date)
    return {
      id: item.id,
      title: item.summary || '(sem título)',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      allDay,
    }
  })
}
