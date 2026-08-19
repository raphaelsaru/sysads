import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { exchangeCodeForToken, exchangeForLongLivedToken, getProfile } from '@/lib/instagram'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = request.cookies.get('ig_oauth_state')?.value

  const redirectTo = new URL('/settings/integrations', url.origin)

  if (!code || !state || !savedState || state !== savedState) {
    redirectTo.searchParams.set('instagram_error', '1')
    return NextResponse.redirect(redirectTo)
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    redirectTo.searchParams.set('instagram_error', '1')
    return NextResponse.redirect(redirectTo)
  }

  try {
    const shortLived = await exchangeCodeForToken(code)
    const longLived = await exchangeForLongLivedToken(shortLived.access_token)
    const profile = await getProfile(longLived.access_token)

    const admin = createAdminClient()
    await admin.from('instagram_accounts').upsert(
      {
        user_id: user.id,
        ig_user_id: profile.user_id,
        username: profile.username,
        access_token: longLived.access_token,
        token_expires_at: new Date(Date.now() + longLived.expires_in * 1000).toISOString(),
        status: 'connected',
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  } catch (error) {
    console.error('Erro ao conectar Instagram:', error)
    redirectTo.searchParams.set('instagram_error', '1')
    return NextResponse.redirect(redirectTo)
  }

  const response = NextResponse.redirect(redirectTo)
  response.cookies.delete('ig_oauth_state')
  return response
}
