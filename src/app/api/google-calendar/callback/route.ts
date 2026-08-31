import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { exchangeCodeForTokens, getUserEmail } from '@/lib/google-calendar'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = request.cookies.get('gcal_oauth_state')?.value

  const redirectTo = new URL('/admin/google-calendar', url.origin)

  if (!code || !state || !savedState || state !== savedState) {
    redirectTo.searchParams.set('gcal_error', '1')
    return NextResponse.redirect(redirectTo)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // Google só devolve refresh_token na primeira autorização (ou com prompt=consent).
      // Se faltar aqui, o usuário precisa revogar o acesso em myaccount.google.com e reconectar.
      redirectTo.searchParams.set('gcal_error', 'no_refresh_token')
      return NextResponse.redirect(redirectTo)
    }

    const email = await getUserEmail(tokens.access_token)
    const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const admin = createAdminClient()
    await admin.from('google_calendar_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await admin.from('google_calendar_connections').insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: expiryDate,
      connected_email: email,
    })
  } catch (error) {
    console.error('Erro ao conectar Google Calendar:', error)
    redirectTo.searchParams.set('gcal_error', '1')
    return NextResponse.redirect(redirectTo)
  }

  const response = NextResponse.redirect(redirectTo)
  response.cookies.delete('gcal_oauth_state')
  return response
}
