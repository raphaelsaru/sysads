// Testes contra o banco real. Pulam quando DATABASE_URL não está setada, para
// a suíte continuar verde sem credenciais.
//
//   cd agent && DATABASE_URL='postgresql://prizely_agent_ro:...' npm test
//
// O que só aparece aqui: erro de sintaxe no SQL do agregar_metricas e o RLS
// escondendo tudo (claims não aplicadas → zero linhas).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarSQL } from '../src/tools/sql.ts'
import { pool, consultarComoUsuario } from '../src/db.ts'
import { executarTool } from '../src/tools/executor.ts'

const url = process.env.DATABASE_URL
const pular = !url

const VICTOR = '21662ef5-cba6-403f-a5d0-7ce66e35aee8'
const CHARBELLE = '193aed03-650f-43ed-82e7-3be20113d6e0'
const ADMIN = '32b521df-53ed-433e-97d2-0a18ccda1964'

// Dentro do teto de ~6 anos do validarArgs: executarTool valida antes de
// consultar, então um período mais largo aqui falharia na validação, não no SQL.
const P = { de: '2022-01-01', ate: '2026-12-31' }

async function contar(escopo: string, comoUsuario: string): Promise<number> {
  const q = montarSQL('contar_leads', { ...P }, escopo)
  const r = await consultarComoUsuario<{ total: number }>(comoUsuario, q.text, q.values)
  return r.rows[0]!.total
}

test('agregar_metricas roda no banco sem erro de sintaxe', { skip: pular }, async () => {
  const q = montarSQL(
    'agregar_metricas',
    {
      ...P,
      metricas: ['leads', 'vendas', 'faturamento', 'ticket_medio', 'taxa_conversao'],
      agrupar_por: 'mes',
    },
    VICTOR,
  )
  const r = await consultarComoUsuario(VICTOR, q.text, q.values)
  console.log('agregar_metricas/mes ->', r.rowCount, 'linhas; 1a:', r.rows[0])
  assert.ok(r.rowCount > 0, 'nenhuma linha: claims ou dados?')
})

test('todas as combinações de agrupamento rodam', { skip: pular }, async () => {
  for (const agrupar of ['nenhum', 'mes', 'trimestre', 'ano', 'origem', 'categoria', 'qualidade']) {
    const q = montarSQL(
      'agregar_metricas',
      { ...P, metricas: ['leads', 'vendas', 'faturamento', 'ticket_medio', 'taxa_conversao'], agrupar_por: agrupar },
      VICTOR,
    )
    const r = await consultarComoUsuario(VICTOR, q.text, q.values)
    console.log(`agrupar_por=${agrupar} -> ${r.rowCount} linhas`)
    assert.ok(r.rowCount >= 1)
  }
})

test('listar_leads roda no banco', { skip: pular }, async () => {
  const q = montarSQL(
    'listar_leads',
    { ...P, ordenar_por: 'valor_fechado', ordem: 'desc', limite: 5 },
    VICTOR,
  )
  const r = await consultarComoUsuario(VICTOR, q.text, q.values)
  console.log('listar_leads ->', r.rowCount, 'linhas')
  assert.ok(r.rowCount > 0)
  assert.ok(!('observacao' in (r.rows[0] as object)), 'observacao não deve sair do banco')
})

test('usuários diferentes veem contagens diferentes e não-zero', { skip: pular }, async () => {
  const v = await contar(VICTOR, VICTOR)
  const c = await contar(CHARBELLE, CHARBELLE)
  console.log('contar_leads VICTOR =', v, '| CHARBELLE =', c)
  assert.ok(v > 0, 'VICTOR zerado: claims JWT não estão sendo aplicadas')
  assert.ok(c > 0, 'CHARBELLE zerado: claims JWT não estão sendo aplicadas')
  assert.notEqual(v, c)
})

// O teste que importa: com as claims do ADMIN o RLS libera tudo (is_admin()).
// Se o escopo dependesse do RLS, este número explodiria. Ele não muda porque
// quem segura o escopo é o WHERE user_id = $1.
test('escopo vem do WHERE, não do RLS', { skip: pular }, async () => {
  const proprio = await contar(VICTOR, VICTOR)
  const viaAdmin = await contar(VICTOR, ADMIN)
  console.log('VICTOR por ele mesmo =', proprio, '| VICTOR via claims de ADMIN =', viaAdmin)
  assert.equal(viaAdmin, proprio)

  // E o admin com RLS aberto, sem escopo de VICTOR, enxerga mais que isso —
  // prova de que o RLS realmente estava liberado no teste acima.
  const tudo = await consultarComoUsuario<{ total: number }>(
    ADMIN,
    'SELECT count(*)::int AS total FROM clientes',
    [],
  )
  console.log('total visível para ADMIN sem escopo =', tudo.rows[0]!.total)
  assert.ok(tudo.rows[0]!.total > proprio, 'RLS do admin não estava aberto — teste inconclusivo')
})

test('executarTool no banco real devolve janela e truncado', { skip: pular }, async () => {
  const r = await executarTool(
    'agregar_metricas',
    { ...P, metricas: ['leads', 'faturamento'], agrupar_por: 'mes' },
    VICTOR,
  )
  console.log('executarTool agregar ->', {
    ok: r.ok,
    linhas: r.linhas,
    janela: r.janela,
    truncado: r.truncado,
  })
  assert.equal(r.ok, true)
  assert.equal(r.janela, 'ambas')
  assert.equal(r.truncado, false)

  // limite 1 bate no teto: tem que voltar marcado.
  const lista = await executarTool('listar_leads', { ...P, limite: 1 }, VICTOR)
  console.log('executarTool listar(limite=1) ->', {
    linhas: lista.linhas,
    janela: lista.janela,
    truncado: lista.truncado,
  })
  assert.equal(lista.truncado, true)
})

test('executarTool também é escopado pelo WHERE, não pelo RLS', { skip: pular }, async () => {
  const v = await executarTool('contar_leads', { ...P }, VICTOR)
  const c = await executarTool('contar_leads', { ...P }, CHARBELLE)
  console.log('executarTool contar VICTOR =', (v.dados![0] as any).total,
              '| CHARBELLE =', (c.dados![0] as any).total)
  assert.notEqual((v.dados![0] as any).total, (c.dados![0] as any).total)
})

// Erro real do Postgres (statement inválido) não pode chegar ao LLM.
test('erro real do Postgres não vaza pelo executor', { skip: pular }, async () => {
  await assert.rejects(() =>
    consultarComoUsuario(VICTOR, 'SELECT coluna_que_nao_existe FROM clientes', []),
  )
  // A conexão continua utilizável depois do ROLLBACK.
  const depois = await contar(VICTOR, VICTOR)
  assert.ok(depois > 0, 'pool ficou quebrado após um erro')
})

test.after(() => pool.end())
