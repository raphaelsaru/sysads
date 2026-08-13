import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executarTool } from '../src/tools/executor.ts'

const ESCOPO = '11111111-1111-1111-1111-111111111111'
const P = { de: '2026-01-01', ate: '2026-01-31' }

// Fake de consultarComoUsuario. Registra as chamadas para provarmos o que
// chegou (ou não chegou) ao banco.
function fake(linhas: unknown[]) {
  const chamadas: Array<{ comoUsuario: string; text: string; values: unknown[] }> = []
  const fn = async (comoUsuario: string, text: string, values: unknown[]) => {
    chamadas.push({ comoUsuario, text, values })
    return { rows: linhas as any[], rowCount: linhas.length }
  }
  return { fn: fn as any, chamadas }
}

function explode(erro: Error) {
  const chamadas: unknown[] = []
  const fn = async () => {
    chamadas.push(1)
    throw erro
  }
  return { fn: fn as any, chamadas }
}

test('args inválidos curto-circuitam antes de tocar o banco', async () => {
  const f = fake([])
  const r = await executarTool('contar_leads', { de: 'ontem', ate: '2026-01-31' }, ESCOPO, f.fn)
  assert.equal(r.ok, false)
  assert.equal(f.chamadas.length, 0, 'validação falhou mas foi ao banco assim mesmo')
  assert.match(r.erro!, /data inicial/)
})

test('tool desconhecida não vai ao banco', async () => {
  const f = fake([])
  const r = await executarTool('apagar_tudo', { ...P }, ESCOPO, f.fn)
  assert.equal(r.ok, false)
  assert.equal(f.chamadas.length, 0)
})

test('a consulta roda com o escopo do servidor nas claims e no $1', async () => {
  const f = fake([{ total: 3 }])
  const r = await executarTool('contar_leads', { ...P }, ESCOPO, f.fn)
  assert.equal(r.ok, true)
  const c = f.chamadas[0]!
  assert.equal(c.comoUsuario, ESCOPO, 'claims do RLS com outro usuário')
  assert.equal(c.values[0], ESCOPO, 'WHERE user_id com outro usuário')
  assert.match(c.text, /user_id = \$1/)
})

test('erro do banco vira mensagem genérica, sem vazar o schema', async () => {
  // Mensagem típica do Postgres: nome de tabela, coluna e posição.
  const bruto = new Error(
    'error: column clientes.valor_fechado does not exist\n' +
      '  at Parser.parseErrorMessage (/x/pg-protocol/src/parser.ts:369:69)',
  )
  ;(bruto as any).code = '42703'
  const f = explode(bruto)
  const r = await executarTool('listar_leads', { ...P }, ESCOPO, f.fn)

  assert.equal(r.ok, false)
  assert.equal(r.erro, 'falha ao consultar os dados')
  for (const vazamento of ['clientes', 'valor_fechado', '42703', 'column', 'pg-protocol', 'SELECT']) {
    assert.ok(!r.erro!.includes(vazamento), `erro vazou "${vazamento}" para o LLM`)
  }
  // E nada de dados/anexos no caminho de erro.
  assert.equal(r.dados, undefined)
  assert.equal(r.linhas, undefined)
})

test('a janela é propagada para o resultado', async () => {
  const f = fake([{ total: 1 }])
  assert.equal((await executarTool('contar_leads', { ...P }, ESCOPO, f.fn)).janela, 'contato')
  assert.equal(
    (await executarTool('contar_leads', { ...P, resultado: 'Venda' }, ESCOPO, f.fn)).janela,
    'venda',
  )
  assert.equal(
    (
      await executarTool(
        'agregar_metricas',
        { ...P, metricas: ['leads', 'faturamento'] },
        ESCOPO,
        f.fn,
      )
    ).janela,
    'ambas',
  )
})

test('truncado dispara no teto e não abaixo dele', async () => {
  const linhas = (n: number) => Array.from({ length: n }, (_, i) => ({ i }))

  const abaixo = await executarTool(
    'listar_leads',
    { ...P, limite: 10 },
    ESCOPO,
    fake(linhas(9)).fn,
  )
  assert.equal(abaixo.truncado, false)

  const noTeto = await executarTool(
    'listar_leads',
    { ...P, limite: 10 },
    ESCOPO,
    fake(linhas(10)).fn,
  )
  assert.equal(noTeto.truncado, true, 'lista cheia não foi marcada como possivelmente truncada')

  // Agrupado: teto de 500.
  const args = { ...P, metricas: ['leads'], agrupar_por: 'origem' }
  assert.equal((await executarTool('agregar_metricas', args, ESCOPO, fake(linhas(499)).fn)).truncado, false)
  assert.equal((await executarTool('agregar_metricas', args, ESCOPO, fake(linhas(500)).fn)).truncado, true)

  // Sem teto (contar_leads / agregar sem agrupamento) nunca marca truncado.
  assert.equal((await executarTool('contar_leads', { ...P }, ESCOPO, fake(linhas(1)).fn)).truncado, false)
  assert.equal(
    (await executarTool('agregar_metricas', { ...P, metricas: ['leads'] }, ESCOPO, fake(linhas(1)).fn))
      .truncado,
    false,
  )
})

test('resultado ok carrega linhas e dados', async () => {
  const f = fake([{ total: 42 }])
  const r = await executarTool('contar_leads', { ...P }, ESCOPO, f.fn)
  assert.deepEqual(r, {
    ok: true,
    tool: 'contar_leads',
    linhas: 1,
    dados: [{ total: 42 }],
    janela: 'contato',
    truncado: false,
  })
})
