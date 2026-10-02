import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getCaller } from '@/lib/tenant-server'
import { pode } from '@/lib/permissions'
import { isUuid } from '@/lib/validacao'

const LIMITE = 50
const DATA = /^\d{4}-\d{2}-\d{2}$/

// Filtro "tipo" da tela → tabelas auditadas
const TABELAS: Record<string, string[]> = {
  leads: ['clientes'],
  negociacoes: ['negociacoes'],
  followups: ['follow_ups'],
  equipe: ['user_profiles', 'vendedor_artistas', 'tenant_owners'],
  empresa: ['tenants'],
}

// GET /api/empresa/logs?antes=<id>&ator=<uuid>&tipo=<leads|...>&de=YYYY-MM-DD&ate=YYYY-MM-DD
// Só dono/superadmin; RLS de audit_log restringe à empresa atual.
export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller()
    if (!caller?.tenantId || !pode(caller.role, 'logs')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const p = request.nextUrl.searchParams
    const supabase = await createClient()
    let query = supabase
      .from('audit_log' as never)
      .select('id, ator_id, ator_nome, tabela, operacao, registro_id, rotulo, mudancas, created_at')
      .eq('tenant_id', caller.tenantId)
      .order('id', { ascending: false })
      .limit(LIMITE + 1)

    const antes = Number(p.get('antes'))
    if (Number.isInteger(antes) && antes > 0) query = query.lt('id', antes)
    const ator = p.get('ator')
    if (ator && isUuid(ator)) query = query.eq('ator_id', ator)
    const tabelas = TABELAS[p.get('tipo') ?? '']
    if (tabelas) query = query.in('tabela', tabelas)
    const de = p.get('de')
    if (de && DATA.test(de)) query = query.gte('created_at', `${de}T00:00:00-03:00`)
    const ate = p.get('ate')
    if (ate && DATA.test(ate)) query = query.lte('created_at', `${ate}T23:59:59.999-03:00`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar logs' }, { status: 500 })

    const linhas = (data ?? []) as unknown as { id: number }[]
    const eventos = linhas.slice(0, LIMITE)
    const proximo = linhas.length > LIMITE ? eventos[eventos.length - 1].id : null
    return NextResponse.json({ eventos, proximo })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
