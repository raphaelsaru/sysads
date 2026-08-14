import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// PATCH /api/admin/users/[id] — libera/revoga o assistente IA para um usuário.
// O trigger `proteger_campos_privilegiados` também bloqueia isso no banco,
// mas checamos o role aqui para falhar com uma mensagem limpa.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const body = await request.json().catch(() => ({}))

    if (typeof body?.assistant_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'assistant_enabled (boolean) é obrigatório' },
        { status: 400 }
      )
    }

    // Merge no jsonb existente — `preferences` também guarda `currency`.
    const { data: atual, error: readError } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', id)
      .single()

    if (readError || !atual) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const preferences = {
      ...((atual.preferences as Record<string, unknown>) || {}),
      assistant_enabled: body.assistant_enabled,
    }

    const { data: atualizado, error: updateError } = await supabase
      .from('user_profiles')
      .update({ preferences })
      .eq('id', id)
      .select('id, preferences')
      .single()

    if (updateError || !atualizado) {
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
    }

    return NextResponse.json({
      id: atualizado.id,
      assistant_enabled:
        (atualizado.preferences as Record<string, unknown>)?.assistant_enabled === true,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
