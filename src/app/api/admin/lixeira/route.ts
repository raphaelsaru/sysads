import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { isSuperadmin } from '@/lib/roles'
import { isUuid } from '@/lib/validacao'

// Lixeira (só superadmin): itens inativados pela trava de exclusão (deleted_at).
// Service role não passa pelo RLS, então enxerga os excluídos de todas as empresas.

const LIMITE = 50
const TABELAS = { leads: 'clientes', negociacoes: 'negociacoes', followups: 'follow_ups' } as const
type Tipo = keyof typeof TABELAS
const isTipo = (t: unknown): t is Tipo => typeof t === 'string' && t in TABELAS

export type ItemLixeira = {
  id: string
  tipo: Tipo
  titulo: string
  detalhe: string | null
  cliente_id: string | null
  empresa: string | null
  responsavel: string | null
  excluido_em: string
  excluido_por: string | null
  lead_excluido: boolean   // negociação/follow-up cujo lead também está na lixeira
}

type Linha = {
  id: string
  tenant_id: string
  deleted_at: string
  deleted_by: string | null
  user_id?: string
  nome?: string
  whatsapp_instagram?: string
  cliente_id?: string
  resultado?: string
  valor_fechado?: number | null
  data_contato?: string
  observacao?: string | null
  clientes?: { nome: string; user_id: string; deleted_at: string | null } | null
}

async function autorizar() {
  const caller = await getCaller()
  if (!caller || !isSuperadmin(caller.role)) return null
  return createAdminClient({ atorId: caller.userId })
}

const negado = () => NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

// GET ?tipo=leads|negociacoes|followups&tenant=<uuid>&antes=<iso>
export async function GET(request: NextRequest) {
  try {
    const admin = await autorizar()
    if (!admin) return negado()
    const p = request.nextUrl.searchParams
    const tipo: Tipo = isTipo(p.get('tipo')) ? (p.get('tipo') as Tipo) : 'leads'

    const colunas = {
      leads: 'id, tenant_id, deleted_at, deleted_by, user_id, nome, whatsapp_instagram',
      negociacoes: 'id, tenant_id, deleted_at, deleted_by, cliente_id, resultado, valor_fechado, data_contato, clientes(nome, user_id, deleted_at)',
      followups: 'id, tenant_id, deleted_at, deleted_by, cliente_id, observacao, clientes(nome, user_id, deleted_at)',
    }[tipo]

    let query = admin.from(TABELAS[tipo]).select(colunas)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(LIMITE + 1)
    const tenant = p.get('tenant')
    if (tenant && isUuid(tenant)) query = query.eq('tenant_id', tenant)
    const antes = p.get('antes')
    if (antes && !Number.isNaN(Date.parse(antes))) query = query.lt('deleted_at', antes)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar lixeira' }, { status: 500 })
    const linhas = ((data ?? []) as unknown as Linha[]).slice(0, LIMITE)

    // Nomes de empresas e pessoas numa consulta cada
    const idsPessoas = [...new Set(linhas.flatMap(l => [l.deleted_by, l.user_id, l.clientes?.user_id]).filter(Boolean))] as string[]
    const idsEmpresas = [...new Set(linhas.map(l => l.tenant_id))]
    const [{ data: pessoas }, { data: empresas }] = await Promise.all([
      idsPessoas.length ? admin.from('user_profiles').select('id, full_name').in('id', idsPessoas) : Promise.resolve({ data: [] }),
      idsEmpresas.length ? admin.from('tenants').select('id, name').in('id', idsEmpresas) : Promise.resolve({ data: [] }),
    ])
    const nome = new Map((pessoas ?? []).map(x => [x.id as string, x.full_name as string | null]))
    const empresa = new Map((empresas ?? []).map(x => [x.id as string, x.name as string]))

    const itens: ItemLixeira[] = linhas.map(l => {
      const lead = l.clientes
      const base = {
        id: l.id,
        tipo,
        empresa: empresa.get(l.tenant_id) ?? null,
        excluido_em: l.deleted_at,
        excluido_por: l.deleted_by ? nome.get(l.deleted_by) ?? 'Usuário removido' : null,
      }
      if (tipo === 'leads') {
        return { ...base, titulo: l.nome ?? '(sem nome)', detalhe: l.whatsapp_instagram ?? null, cliente_id: l.id,
          responsavel: l.user_id ? nome.get(l.user_id) ?? null : null, lead_excluido: false }
      }
      const detalhe = tipo === 'negociacoes'
        ? [l.resultado, l.valor_fechado != null ? `R$ ${Number(l.valor_fechado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null, l.data_contato]
            .filter(Boolean).join(' · ')
        : (l.observacao ?? '').slice(0, 120) || null
      return { ...base, titulo: lead?.nome ?? '(lead removido)', detalhe, cliente_id: l.cliente_id ?? null,
        responsavel: lead?.user_id ? nome.get(lead.user_id) ?? null : null, lead_excluido: !!lead?.deleted_at }
    })

    const proximo = (data ?? []).length > LIMITE ? linhas[linhas.length - 1].deleted_at : null
    return NextResponse.json({ itens, proximo })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST { tipo, id } — restaura (deleted_at volta a null)
export async function POST(request: NextRequest) {
  try {
    const admin = await autorizar()
    if (!admin) return negado()
    const body = await request.json().catch(() => ({}))
    if (!isTipo(body?.tipo) || !isUuid(body?.id)) {
      return NextResponse.json({ error: 'Item inválido' }, { status: 400 })
    }
    const tipo = body.tipo as Tipo

    // Negociação/follow-up de lead excluído: restaurar o lead primeiro
    if (tipo !== 'leads') {
      const { data: item } = await admin.from(TABELAS[tipo])
        .select('clientes(deleted_at)').eq('id', body.id).maybeSingle()
      const lead = (item as { clientes?: { deleted_at: string | null } | null } | null)?.clientes
      if (lead?.deleted_at) {
        return NextResponse.json({ error: 'O lead deste item também está na lixeira. Restaure o lead primeiro.' }, { status: 409 })
      }
    }

    const { data, error } = await admin.from(TABELAS[tipo])
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', body.id).not('deleted_at', 'is', null)
      .select('id')
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um lead ativo com esse telefone/Instagram nesta empresa.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Erro ao restaurar' }, { status: 500 })
    }
    if (!data?.length) return NextResponse.json({ error: 'Item não está na lixeira' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE ?tipo=&id= — exclusão definitiva (só itens que já estão na lixeira)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await autorizar()
    if (!admin) return negado()
    const tipo = request.nextUrl.searchParams.get('tipo')
    const id = request.nextUrl.searchParams.get('id')
    if (!isTipo(tipo) || !isUuid(id)) return NextResponse.json({ error: 'Item inválido' }, { status: 400 })

    const { data, error } = await admin.from(TABELAS[tipo])
      .delete().eq('id', id).not('deleted_at', 'is', null).select('id')
    if (error) return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Item não está na lixeira' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
