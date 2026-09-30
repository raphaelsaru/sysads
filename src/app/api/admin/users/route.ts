import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
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

    const { data: userProfiles, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, role, full_name, created_at, preferences, tenant_id, is_active')
      .order('created_at', { ascending: false })

    if (usersError) {
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    let authUsers: { users: Array<{ id: string; email?: string; user_metadata?: Record<string, unknown> }> } | null = null
    try {
      const adminClient = createAdminClient()
      // listUsers pagina (padrão 50); percorre todas as páginas.
      const todos: Array<{ id: string; email?: string; user_metadata?: Record<string, unknown> }> = []
      for (let page = 1; ; page++) {
        const { data, error: adminError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
        if (adminError) break
        todos.push(...data.users)
        if (data.users.length < 1000) break
      }
      authUsers = { users: todos }
    } catch {
      // continue without emails
    }

    const users = (userProfiles || []).map((profile) => {
      const authUser = authUsers?.users.find(u => u.id === profile.id)
      const preferences = (profile.preferences as Record<string, unknown>) || {}
      const currency = (preferences.currency as string) ?? (authUser?.user_metadata?.currency as string) ?? 'BRL'

      return {
        id: profile.id,
        email: authUser?.email || 'N/A',
        full_name: profile.full_name,
        company_name: profile.full_name || 'Sem nome',
        currency,
        role: profile.role,
        tenant_id: profile.tenant_id,
        is_active: profile.is_active,
        assistant_enabled: preferences.assistant_enabled === true,
        created_at: profile.created_at,
      }
    })

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
