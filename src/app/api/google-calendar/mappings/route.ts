import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, usuarioNaEmpresa } from '@/lib/tenant-server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' ? user : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  // Só usuários da empresa atual (visitada, p/ superadmin).
  const caller = await getCaller()
  if (!caller?.tenantId) return NextResponse.json({ mappings: [] })

  const supabaseAdmin = createAdminClient()

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, role')
    .eq('tenant_id', caller.tenantId)
    .order('full_name', { ascending: true })

  if (profilesError) {
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
  }

  const { data: mappings } = await supabaseAdmin
    .from('google_calendar_mappings')
    .select('user_id, calendar_id, calendar_name')
    .in('user_id', (profiles ?? []).map((p) => p.id))

  const mappingByUser = new Map((mappings ?? []).map((m) => [m.user_id, m]))

  const result = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    calendar_id: mappingByUser.get(p.id)?.calendar_id ?? null,
    calendar_name: mappingByUser.get(p.id)?.calendar_name ?? null,
  }))

  return NextResponse.json({ mappings: result })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const userId = body?.userId as string | undefined
  const calendarId = body?.calendarId as string | undefined
  const calendarName = body?.calendarName as string | undefined

  if (!userId || !calendarId) {
    return NextResponse.json({ error: 'userId e calendarId são obrigatórios' }, { status: 400 })
  }

  const caller = await getCaller()
  const supabaseAdmin = createAdminClient()
  if (!caller?.tenantId || !(await usuarioNaEmpresa(supabaseAdmin, userId, caller.tenantId))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('google_calendar_mappings')
    .upsert(
      { user_id: userId, calendar_id: calendarId, calendar_name: calendarName ?? null },
      { onConflict: 'user_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar mapeamento' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
