import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam, isRoleConvidavel } from '@/lib/roles'
import { pode } from '@/lib/permissions'
import { convidarUsuario, normalizarEmail } from '@/lib/convite'

// GET /api/empresa/usuarios[?ativos=1] — equipe da empresa atual.
export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !pode(caller.role, 'ver_empresa')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const supabase = await createClient()
    let query = supabase
      .from('user_profiles')
      .select('id, role, full_name, is_active, created_at, preferences')
      .eq('tenant_id', caller.tenantId)
      .order('full_name')
    if (request.nextUrl.searchParams.get('ativos') === '1') query = query.eq('is_active', true)

    const [{ data: perfis, error }, { data: tenant }] = await Promise.all([
      query,
      supabase.from('tenants').select('max_users').eq('id', caller.tenantId).single(),
    ])
    if (error) return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })

    // Emails e status de convite vêm do auth (service role). Equipes pequenas: paralelo.
    const admin = createAdminClient()
    const usuarios = await Promise.all((perfis ?? []).map(async ({ preferences, ...p }) => {
      const { data } = await admin.auth.admin.getUserById(p.id)
      const prefs = (preferences as Record<string, unknown>) || {}
      return {
        ...p,
        email: data.user?.email ?? null,
        currency: (prefs.currency as string) ?? (data.user?.user_metadata?.currency as string) ?? 'BRL',
        convite_pendente: !data.user?.last_sign_in_at,
      }
    }))

    return NextResponse.json({
      usuarios,
      slots: { usados: usuarios.filter(u => u.is_active).length, total: tenant?.max_users ?? null },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/empresa/usuarios { email, full_name, role? } — convida p/ empresa atual.
export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !canManageTeam(caller.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const email = normalizarEmail(body?.email)
    const full_name = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
    if (!full_name || !body?.email) {
      return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 })
    }
    if (!email) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    const role: unknown = body?.role ?? 'user'
    if (!isRoleConvidavel(role)) return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })

    const r = await convidarUsuario({
      admin: createAdminClient(),
      email,
      full_name,
      tenantId: caller.tenantId,
      role,
      origin: request.nextUrl.origin,
    })
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json(r, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
