import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarSQL } from '../src/tools/sql.ts'

const ESCOPO = '11111111-1111-1111-1111-111111111111'
const P = { de: '2026-01-01', ate: '2026-01-31' }

// Um pedido válido de cada tool, para os testes que varrem as três.
const PEDIDOS: Array<{ tool: string; args: Record<string, any> }> = [
  { tool: 'agregar_metricas', args: { ...P, metricas: ['leads', 'faturamento'], agrupar_por: 'mes' } },
  { tool: 'contar_leads', args: { ...P, resultado: 'Venda' } },
  { tool: 'listar_leads', args: { ...P, ordenar_por: 'valor_fechado', ordem: 'desc', limite: 5 } },
]

// Literais que ESCREVEMOS de propósito no SQL. Qualquer outro literal entre
// aspas simples no texto significa que um valor vazou para dentro da query.
const LITERAIS_PERMITIDOS = new Set([
  'month', 'quarter', 'year', 'Venda', '—',
])

function literais(text: string): string[] {
  return [...text.matchAll(/'([^']*)'/g)].map((m) => m[1] as string)
}

test('toda query filtra por user_id no parâmetro 1', () => {
  for (const { tool, args } of PEDIDOS) {
    const q = montarSQL(tool, args, ESCOPO)
    assert.match(q.text, /user_id\s*=\s*\$1/, `${tool} sem filtro de escopo`)
    assert.equal(q.values[0], ESCOPO, `${tool}: escopo não é o parâmetro 1`)
  }
})

test('nenhum valor é interpolado direto no texto', () => {
  const veneno = "'; DROP TABLE clientes;--"
  for (const tool of ['contar_leads', 'listar_leads']) {
    const q = montarSQL(tool, { ...P, origem: veneno, categoria: veneno }, ESCOPO)
    assert.ok(!q.text.includes(veneno), `${tool} interpolou o valor`)
    assert.ok(!q.text.includes('DROP'), `${tool} interpolou o valor`)
    assert.ok(q.values.includes(veneno), `${tool} não parametrizou o valor`)
  }
})

test('todo valor do usuário vai parametrizado', () => {
  const pedidos = [
    ...PEDIDOS,
    {
      tool: 'contar_leads',
      args: { ...P, resultado: 'Venda', origem: 'WhatsApp', categoria: 'Victor', venda_paga: true },
    },
  ]
  for (const { tool, args } of pedidos) {
    const q = montarSQL(tool, args, ESCOPO)

    for (const v of q.values.slice(1)) {
      assert.ok(
        !q.text.includes(String(v)),
        `${tool}: valor ${String(v)} aparece no texto do SQL`,
      )
    }

    for (const lit of literais(q.text)) {
      assert.ok(
        LITERAIS_PERMITIDOS.has(lit),
        `${tool}: literal inesperado no SQL: '${lit}'`,
      )
    }
  }
})

test('escopo é sempre o parâmetro 1, mesmo com muitos filtros', () => {
  const q = montarSQL(
    'contar_leads',
    {
      ...P,
      resultado: 'Venda',
      origem: 'Instagram',
      categoria: 'Charbelle',
      venda_paga: true,
      nao_respondeu: false,
    },
    ESCOPO,
  )
  assert.equal(q.values[0], ESCOPO)
  // de, ate + 5 filtros + escopo
  assert.equal(q.values.length, 8)
  // $1 usado uma única vez, e só no filtro de escopo.
  const usos = q.text.match(/\$1(?!\d)/g) ?? []
  assert.equal(usos.length, 1, 'algum filtro deslocou o $1')
  assert.match(q.text, /user_id\s*=\s*\$1/)
})

test('user_id nos args do LLM é ignorado', () => {
  // validar() já constrói os args do zero, mas o escopo não pode depender disso:
  // o argumento `escopo` é a única fonte, mesmo se algo injetar user_id nos args.
  const INTRUSO = '99999999-9999-9999-9999-999999999999'
  for (const { tool, args } of PEDIDOS) {
    const q = montarSQL(tool, { ...args, user_id: INTRUSO, scope_user_id: INTRUSO }, ESCOPO)
    assert.equal(q.values[0], ESCOPO, `${tool}: escopo veio dos args do LLM`)
    assert.ok(!q.values.includes(INTRUSO), `${tool}: user_id do LLM entrou nos parâmetros`)
    assert.ok(!q.text.includes(INTRUSO))
  }
})

test('listar_leads sempre tem LIMIT', () => {
  for (const args of [{ ...P }, { ...P, limite: 5 }, { ...P, limite: 50 }]) {
    const q = montarSQL('listar_leads', args, ESCOPO)
    assert.match(q.text, /\bLIMIT\s+\d+/)
  }
  // Limite absurdo vindo de fora ainda é clampado.
  const q = montarSQL('listar_leads', { ...P, limite: 5000 }, ESCOPO)
  const m = q.text.match(/\bLIMIT\s+(\d+)/)
  assert.ok(m)
  assert.ok(Number(m![1]) <= 50, 'limite não foi clampado')
})

test('listar_leads não devolve observacao', () => {
  const q = montarSQL('listar_leads', { ...P }, ESCOPO)
  assert.ok(!q.text.includes('observacao'), 'observacao é vetor de prompt injection')
  assert.match(q.text, /\bnome\b/)
  assert.match(q.text, /NULLS LAST/)
})

test('faturamento usa data_mes_venda, leads usam data_contato', () => {
  const fat = montarSQL('agregar_metricas', { ...P, metricas: ['faturamento'] }, ESCOPO)
  assert.match(fat.text, /data_mes_venda/)
  assert.ok(!fat.text.includes('data_contato'), 'faturamento não deve usar data_contato')

  const leads = montarSQL('agregar_metricas', { ...P, metricas: ['leads'] }, ESCOPO)
  assert.match(leads.text, /data_contato/)
  assert.ok(!leads.text.includes('data_mes_venda'), 'leads não devem usar data_mes_venda')

  // contar_leads é métrica de lead.
  const contar = montarSQL('contar_leads', { ...P }, ESCOPO)
  assert.match(contar.text, /data_contato/)
})

test('métricas de lead e de venda no mesmo pedido', () => {
  const q = montarSQL(
    'agregar_metricas',
    { ...P, metricas: ['leads', 'faturamento'], agrupar_por: 'mes' },
    ESCOPO,
  )
  // As duas janelas presentes, cada uma no bucket certo.
  assert.match(q.text, /date_trunc\('month',\s*data_contato\)/)
  assert.match(q.text, /date_trunc\('month',\s*data_mes_venda\)/)
  // count(*) (leads) fica na janela de data_contato; sum(valor_fechado) na de venda.
  const idxLead = q.text.indexOf('data_contato')
  const idxVenda = q.text.indexOf('data_mes_venda')
  assert.ok(idxLead >= 0 && idxVenda >= 0)
})

test('agrupar por mês produz bucket de mês', () => {
  const q = montarSQL('agregar_metricas', { ...P, metricas: ['leads'], agrupar_por: 'mes' }, ESCOPO)
  assert.match(q.text, /date_trunc\('month'/)
  assert.match(q.text, /GROUP BY/)
  assert.match(q.text, /\bLIMIT\s+\d+/)
})

test('agrupar por origem não interpola nome de coluna vindo de fora', () => {
  const q = montarSQL(
    'agregar_metricas',
    { ...P, metricas: ['leads'], agrupar_por: 'origem' },
    ESCOPO,
  )
  assert.match(q.text, /origem::text/)

  // Agrupamento fora da allowlist não vira texto SQL: levanta erro.
  assert.throws(() =>
    montarSQL(
      'agregar_metricas',
      { ...P, metricas: ['leads'], agrupar_por: 'origem; DROP TABLE clientes;--' },
      ESCOPO,
    ),
  )
})

test('ticket_medio e taxa_conversao não dividem por zero', () => {
  const t = montarSQL('agregar_metricas', { ...P, metricas: ['ticket_medio'] }, ESCOPO)
  assert.match(t.text, /CASE\s+WHEN[^)]*=\s*0/i, 'ticket_medio sem guarda de divisão por zero')

  const c = montarSQL('agregar_metricas', { ...P, metricas: ['taxa_conversao'] }, ESCOPO)
  assert.match(c.text, /CASE\s+WHEN[^)]*=\s*0/i, 'taxa_conversao sem guarda de divisão por zero')
  // taxa_conversao mistura as duas janelas (vendas / leads).
  assert.match(c.text, /data_contato/)
  assert.match(c.text, /data_mes_venda/)
})

test('ordenacao só sai da allowlist', () => {
  const q = montarSQL(
    'listar_leads',
    { ...P, ordenar_por: 'valor_fechado', ordem: 'asc' },
    ESCOPO,
  )
  assert.match(q.text, /ORDER BY valor_fechado asc NULLS LAST/)

  assert.throws(() =>
    montarSQL('listar_leads', { ...P, ordenar_por: 'nome; DROP TABLE clientes' }, ESCOPO),
  )
  assert.throws(() => montarSQL('listar_leads', { ...P, ordem: 'asc; DROP TABLE clientes' }, ESCOPO))
})

test('a janela usada é declarada no resultado', () => {
  // O modelo não vê o SQL. Se a janela não voltar junto, ele narra
  // "leads contatados em julho" para uma janela de data_mes_venda.
  const casos: Array<[string, Record<string, any>, string, string]> = [
    ['contar_leads', { ...P }, 'contato', 'data_contato'],
    ['contar_leads', { ...P, resultado: 'Venda' }, 'venda', 'data_mes_venda'],
    ['contar_leads', { ...P, venda_paga: true }, 'venda', 'data_mes_venda'],
    ['listar_leads', { ...P }, 'contato', 'data_contato'],
    ['listar_leads', { ...P, resultado: 'Venda' }, 'venda', 'data_mes_venda'],
    ['listar_leads', { ...P, ordenar_por: 'data_mes_venda' }, 'venda', 'data_mes_venda'],
  ]
  for (const [tool, args, janela, coluna] of casos) {
    const q = montarSQL(tool, args, ESCOPO)
    assert.equal(q.janela, janela, `${tool} ${JSON.stringify(args)}`)
    // A janela declarada é a que realmente delimita o BETWEEN.
    assert.match(q.text, new RegExp(`WHERE user_id = \\$1 AND ${coluna} BETWEEN`))
  }
})

test('agregar_metricas declara ambas quando mistura as janelas', () => {
  const so_lead = montarSQL('agregar_metricas', { ...P, metricas: ['leads'] }, ESCOPO)
  assert.equal(so_lead.janela, 'contato')

  const so_venda = montarSQL('agregar_metricas', { ...P, metricas: ['faturamento'] }, ESCOPO)
  assert.equal(so_venda.janela, 'venda')

  const mista = montarSQL('agregar_metricas', { ...P, metricas: ['leads', 'faturamento'] }, ESCOPO)
  assert.equal(mista.janela, 'ambas')

  // taxa_conversao sozinha já mistura (vendas / leads).
  const taxa = montarSQL('agregar_metricas', { ...P, metricas: ['taxa_conversao'] }, ESCOPO)
  assert.equal(taxa.janela, 'ambas')
})

test('o teto de linhas aplicado é declarado', () => {
  assert.equal(montarSQL('contar_leads', { ...P }, ESCOPO).limite, null)
  assert.equal(montarSQL('listar_leads', { ...P, limite: 7 }, ESCOPO).limite, 7)
  assert.equal(montarSQL('listar_leads', { ...P, limite: 5000 }, ESCOPO).limite, 50)
  // Sem agrupamento sai 1 linha só: nada a truncar.
  assert.equal(montarSQL('agregar_metricas', { ...P, metricas: ['leads'] }, ESCOPO).limite, null)
  const g = montarSQL('agregar_metricas', { ...P, metricas: ['leads'], agrupar_por: 'mes' }, ESCOPO)
  assert.equal(g.limite, 200)
  assert.match(g.text, /LIMIT 200/)
})

test('o limite declarado é o mesmo que foi para o SQL', () => {
  for (const limite of [1, 7, 20, 50, 5000]) {
    const q = montarSQL('listar_leads', { ...P, limite }, ESCOPO)
    const m = q.text.match(/\bLIMIT\s+(\d+)/)
    assert.equal(Number(m![1]), q.limite)
  }
})

test('tool sem SQL levanta erro', () => {
  assert.throws(() => montarSQL('apagar_tudo', { ...P }, ESCOPO), /tool/)
})
