// Construção do SQL a partir dos argumentos já validados.
//
// INVARIANTES (a segurança da feature inteira mora aqui):
//  1. Toda query tem `user_id = $1` e values[0] é o scopeUserId resolvido pelo
//     servidor. Nenhum filtro pode empurrar o escopo para outro parâmetro:
//     values[0] é escrito antes de qualquer push.
//  2. Nada vindo do LLM vira texto SQL. `agrupar_por`, `ordenar_por`, `ordem` e
//     `limite` só passam pelos mapas fechados deste arquivo; qualquer valor fora
//     da allowlist levanta erro em vez de virar string.
//  3. `origem`, `categoria`, `resultado`, `de`, `ate` e os booleanos são VALORES
//     — vão sempre em $n. `origem`/`categoria` são texto livre vindo do webhook
//     do WhatsApp; interpolar significaria injeção direta.
//  4. Métrica de lead conta pela janela `data_contato`; métrica de venda/receita
//     conta por `data_mes_venda` (coluna gerada), igual ao dashboard. Misturar as
//     duas faz o assistente discordar da tela que o usuário está olhando.

export interface Query {
  text: string
  values: unknown[]
}

// Mapa fechado: agrupamento -> expressão SQL. Nada vem de string do LLM.
const BUCKETS: Record<string, { lead: string; venda: string }> = {
  mes: { lead: `date_trunc('month', data_contato)`, venda: `date_trunc('month', data_mes_venda)` },
  trimestre: {
    lead: `date_trunc('quarter', data_contato)`,
    venda: `date_trunc('quarter', data_mes_venda)`,
  },
  ano: { lead: `date_trunc('year', data_contato)`, venda: `date_trunc('year', data_mes_venda)` },
  origem: { lead: `origem::text`, venda: `origem::text` },
  categoria: { lead: `coalesce(categoria, '—')`, venda: `coalesce(categoria, '—')` },
  qualidade: {
    lead: `coalesce(qualidade_contato, '—')`,
    venda: `coalesce(qualidade_contato, '—')`,
  },
}

type Janela = 'lead' | 'venda'

// Cada métrica-base declara sobre qual janela de data ela conta.
const EXPR: Record<string, { sql: string; janela: Janela }> = {
  leads: { janela: 'lead', sql: `count(*)` },
  nao_respondeu: { janela: 'lead', sql: `count(*) FILTER (WHERE nao_respondeu)` },
  orcamentos_enviados: { janela: 'lead', sql: `count(*) FILTER (WHERE orcamento_enviado)` },
  vendas: { janela: 'venda', sql: `count(*) FILTER (WHERE resultado = 'Venda')` },
  faturamento: {
    janela: 'venda',
    sql: `coalesce(sum(valor_fechado) FILTER (WHERE resultado = 'Venda'), 0)`,
  },
  sinais_pagos: { janela: 'venda', sql: `count(*) FILTER (WHERE pagou_sinal)` },
  valor_sinais: { janela: 'venda', sql: `coalesce(sum(valor_sinal) FILTER (WHERE pagou_sinal), 0)` },
}

// Derivadas: calculadas em SQL com guarda de divisão por zero. Nunca em JS e
// muito menos pelo LLM — o modelo erra conta e narra o erro com confiança.
const DERIVADAS: Record<string, { depende: string[]; sql: string }> = {
  ticket_medio: {
    depende: ['vendas', 'faturamento'],
    sql: `CASE WHEN v.vendas IS NULL OR v.vendas = 0 THEN 0
               ELSE round(v.faturamento::numeric / v.vendas, 2) END`,
  },
  taxa_conversao: {
    depende: ['leads', 'vendas'],
    sql: `CASE WHEN l.leads IS NULL OR l.leads = 0 THEN 0
               ELSE round(coalesce(v.vendas, 0)::numeric / l.leads, 4) END`,
  },
}

// Colunas fixas de listar_leads. `observacao` fica de fora de propósito:
// é texto livre do webhook e vetor de prompt injection para o LLM.
const COLUNAS_LEAD = [
  'id',
  'nome',
  'data_contato',
  'data_mes_venda',
  'resultado',
  'origem::text AS origem',
  'categoria',
  'qualidade_contato',
  'valor_fechado',
  'valor_sinal',
  'pagou_sinal',
  'venda_paga',
  'nao_respondeu',
  'orcamento_enviado',
].join(', ')

const ORDENAVEIS = new Set(['data_contato', 'valor_fechado', 'data_mes_venda'])
const ORDENS = new Set(['asc', 'desc'])

const LIMITE_LISTA = 50
const LIMITE_GRUPOS = 200

// Colunas de filtro -> como comparar. Só chaves daqui viram SQL.
// origem é enum (origem_tipo): compara como texto, senão texto arbitrário do
// webhook estoura "invalid input value for enum".
const FILTROS: Record<string, string> = {
  resultado: 'resultado',
  origem: 'origem::text',
  categoria: 'categoria',
  venda_paga: 'venda_paga',
  nao_respondeu: 'nao_respondeu',
}

// Acumulador de parâmetros. values[0] é o escopo, sempre.
class Params {
  readonly values: unknown[]
  constructor(scopeUserId: string) {
    this.values = [scopeUserId]
  }
  add(v: unknown): string {
    return `$${this.values.push(v)}`
  }
}

function condicoesFiltro(args: Record<string, any>, p: Params): string[] {
  const out: string[] = []
  for (const [campo, coluna] of Object.entries(FILTROS)) {
    const v = args[campo]
    if (v === undefined || v === null) continue
    out.push(`${coluna} = ${p.add(v)}`)
  }
  return out
}

function inteiroClampado(bruto: unknown, padrao: number, max: number): number {
  const n = Number(bruto ?? padrao)
  if (!Number.isFinite(n)) return padrao
  return Math.min(Math.max(1, Math.trunc(n)), max)
}

function montarContarLeads(args: Record<string, any>, escopo: string): Query {
  const p = new Params(escopo)
  const where = [
    'user_id = $1',
    `data_contato BETWEEN ${p.add(args.de)}::date AND ${p.add(args.ate)}::date`,
    ...condicoesFiltro(args, p),
  ]
  return {
    text: `SELECT count(*)::int AS total FROM clientes WHERE ${where.join(' AND ')}`,
    values: p.values,
  }
}

// Janela do listar_leads: por padrão é lead (data_contato). Quando o pedido é
// claramente sobre vendas, usa data_mes_venda para bater com o dashboard.
function janelaDaLista(args: Record<string, any>): Janela {
  if (args.resultado === 'Venda') return 'venda'
  if (args.venda_paga === true) return 'venda'
  if (args.ordenar_por === 'data_mes_venda') return 'venda'
  return 'lead'
}

function montarListarLeads(args: Record<string, any>, escopo: string): Query {
  const ordenarPor = String(args.ordenar_por ?? 'data_contato')
  if (!ORDENAVEIS.has(ordenarPor)) throw new Error(`ordenação não permitida: ${ordenarPor}`)
  const ordem = String(args.ordem ?? 'desc')
  if (!ORDENS.has(ordem)) throw new Error(`ordem não permitida: ${ordem}`)
  const limite = inteiroClampado(args.limite, 20, LIMITE_LISTA)

  const coluna = janelaDaLista(args) === 'venda' ? 'data_mes_venda' : 'data_contato'

  const p = new Params(escopo)
  const where = [
    'user_id = $1',
    `${coluna} BETWEEN ${p.add(args.de)}::date AND ${p.add(args.ate)}::date`,
    ...condicoesFiltro(args, p),
  ]

  const text =
    `SELECT ${COLUNAS_LEAD} FROM clientes WHERE ${where.join(' AND ')} ` +
    `ORDER BY ${ordenarPor} ${ordem} NULLS LAST LIMIT ${limite}`
  return { text, values: p.values }
}

function montarAgregar(args: Record<string, any>, escopo: string): Query {
  const pedidas: string[] = args.metricas
  const agrupar = String(args.agrupar_por ?? 'nenhum')
  if (agrupar !== 'nenhum' && !Object.prototype.hasOwnProperty.call(BUCKETS, agrupar)) {
    throw new Error(`agrupamento desconhecido: ${agrupar}`)
  }
  const bucket = agrupar === 'nenhum' ? null : BUCKETS[agrupar]!

  // Bases realmente necessárias, incluindo as que só existem para as derivadas.
  const bases: Record<Janela, string[]> = { lead: [], venda: [] }
  const addBase = (m: string) => {
    const e = EXPR[m]
    if (!e) throw new Error(`métrica desconhecida: ${m}`)
    if (!bases[e.janela].includes(m)) bases[e.janela].push(m)
  }
  for (const m of pedidas) {
    const d = DERIVADAS[m]
    if (d) d.depende.forEach(addBase)
    else addBase(m)
  }

  const p = new Params(escopo)
  const pDe = p.add(args.de)
  const pAte = p.add(args.ate)

  const cte = (janela: Janela, alias: string, coluna: string) => {
    const cols = bases[janela].map((m) => `${EXPR[m]!.sql} AS ${m}`)
    const sel = bucket ? [`${bucket[janela]} AS grupo`, ...cols] : cols
    return (
      `${alias} AS (SELECT ${sel.join(', ')} FROM clientes ` +
      `WHERE user_id = $1 AND ${coluna} BETWEEN ${pDe}::date AND ${pAte}::date` +
      `${bucket ? ' GROUP BY 1' : ''})`
    )
  }

  const ctes: string[] = []
  const usaLead = bases.lead.length > 0
  const usaVenda = bases.venda.length > 0
  if (usaLead) ctes.push(cte('lead', 'l', 'data_contato'))
  if (usaVenda) ctes.push(cte('venda', 'v', 'data_mes_venda'))

  const saidas: string[] = []
  if (bucket) {
    saidas.push(usaLead && usaVenda ? 'coalesce(l.grupo, v.grupo) AS grupo' : `${usaLead ? 'l' : 'v'}.grupo AS grupo`)
  }
  for (const m of pedidas) {
    const d = DERIVADAS[m]
    if (d) {
      saidas.push(`${d.sql} AS ${m}`)
      continue
    }
    const alias = EXPR[m]!.janela === 'lead' ? 'l' : 'v'
    saidas.push(`coalesce(${alias}.${m}, 0) AS ${m}`)
  }

  let from: string
  if (usaLead && usaVenda) {
    // FULL OUTER exige condição hash/merge-joinable: `=`, não IS NOT DISTINCT FROM.
    from = bucket ? 'l FULL OUTER JOIN v ON l.grupo = v.grupo' : 'l CROSS JOIN v'
  } else {
    from = usaLead ? 'l' : 'v'
  }

  const text =
    `WITH ${ctes.join(', ')} SELECT ${saidas.join(', ')} FROM ${from}` +
    (bucket ? ` ORDER BY 1 LIMIT ${LIMITE_GRUPOS}` : '')
  return { text, values: p.values }
}

/**
 * Traduz argumentos JÁ VALIDADOS em SQL parametrizado com escopo forçado.
 * `escopo` vem do resolveScope (token verificado), nunca do LLM.
 */
export function montarSQL(tool: string, args: Record<string, any>, escopo: string): Query {
  switch (tool) {
    case 'agregar_metricas':
      return montarAgregar(args, escopo)
    case 'contar_leads':
      return montarContarLeads(args, escopo)
    case 'listar_leads':
      return montarListarLeads(args, escopo)
    default:
      throw new Error(`tool sem SQL: ${tool}`)
  }
}
