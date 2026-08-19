import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('instagram_accounts')
    .select('username, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row || row.status !== 'connected') {
    return NextResponse.json({ status: 'not_connected' })
  }

  return NextResponse.json({ status: 'connected', username: row.username })
}
