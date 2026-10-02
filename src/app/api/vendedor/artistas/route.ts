import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'

// GET — artistas ativos que o vendedor logado atende na empresa atual.
export async function GET() {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || caller.role !== 'vendedor') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const admin = createAdminClient()
    const { data: vinculos, error } = await admin.from('vendedor_artistas')
      .select('artista_id').eq('vendedor_id', caller.userId).eq('tenant_id', caller.tenantId)
    if (error) return NextResponse.json({ error: 'Erro ao buscar artistas' }, { status: 500 })
    const ids = (vinculos ?? []).map(v => v.artista_id)
    if (ids.length === 0) return NextResponse.json({ artistas: [] })

    const { data: perfis, error: perfisError } = await admin.from('user_profiles')
      .select('id, full_name, role, is_active, preferences')
      .in('id', ids).eq('tenant_id', caller.tenantId).eq('role', 'user').eq('is_active', true)
      .order('full_name')
    if (perfisError) return NextResponse.json({ error: 'Erro ao buscar artistas' }, { status: 500 })

    // Mesmo formato de /api/empresa/usuarios (email/moeda vêm do auth). Listas pequenas.
    const artistas = await Promise.all((perfis ?? []).map(async ({ preferences, ...p }) => {
      const { data } = await admin.auth.admin.getUserById(p.id)
      const prefs = (preferences as Record<string, unknown>) || {}
      return {
        ...p,
        email: data.user?.email ?? null,
        currency: (prefs.currency as string) ?? (data.user?.user_metadata?.currency as string) ?? 'BRL',
      }
    }))
    return NextResponse.json({ artistas })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
