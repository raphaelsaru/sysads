import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// PATCH { capturar_nao_seguidos } — regra de leads sem anúncio da própria conta.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  if (typeof body?.capturar_nao_seguidos !== 'boolean') {
    return NextResponse.json({ error: 'capturar_nao_seguidos (boolean) é obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('instagram_accounts')
    .update({ capturar_nao_seguidos: body.capturar_nao_seguidos })
    .eq('user_id', user.id)
    .select('capturar_nao_seguidos')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Instagram não conectado' }, { status: 404 })
  return NextResponse.json(data)
}
