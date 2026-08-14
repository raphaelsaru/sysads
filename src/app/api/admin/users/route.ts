import { NextRequest, NextResponse } from 'next/server'
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
      .select('id, role, full_name, created_at, preferences')
      .order('created_at', { ascending: false })

    if (usersError) {
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    }

    let authUsers: { users: Array<{ id: string; email?: string; user_metadata?: Record<string, unknown> }> } | null = null
    try {
      const adminClient = createAdminClient()
      const { data, error: adminError } = await adminClient.auth.admin.listUsers()
      if (!adminError) authUsers = data
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
        assistant_enabled: preferences.assistant_enabled === true,
        created_at: profile.created_at,
      }
    })

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const { email, password, full_name, role, phone } = await request.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, senha e nome são obrigatórios' }, { status: 400 })
    }

    const validRoles = ['admin', 'user']
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role inválida. Use: admin ou user' }, { status: 400 })
    }

    const newUserRole = role || 'user'

    try {
      const adminClient = createAdminClient()

      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      })

      if (createError || !authUser.user) {
        return NextResponse.json({ error: createError?.message || 'Erro ao criar usuário' }, { status: 500 })
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authUser.user.id,
          role: newUserRole,
          full_name,
          phone: phone || null,
        })
        .select()
        .single()

      if (profileError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ error: 'Erro ao criar perfil do usuário' }, { status: 500 })
      }

      return NextResponse.json({ user: userProfile, message: 'Usuário criado' }, { status: 201 })
    } catch {
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
