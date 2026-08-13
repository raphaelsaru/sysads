import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarInsert, auditar, type EventoAuditoria } from '../src/audit.ts'

const BASE: EventoAuditoria = {
  requesterId: 'req-1',
  scopeUserId: 'scope-1',
  pergunta: 'quantos leads em julho?',
  bloqueado: false,
}

function valores(e: EventoAuditoria) {
  return montarInsert(e).values
}

test('insere na tabela certa, com jsonb e nove parâmetros', () => {
  const q = montarInsert(BASE)
  assert.match(q.text, /INSERT INTO assistant_audit_log/)
  assert.match(q.text, /\$4::jsonb/)
  assert.match(q.text, /\$9\)/)
  assert.equal(q.values.length, 9)
  // Nada de escrita além do INSERT — o papel só tem INSERT nessa tabela.
  assert.ok(!/UPDATE|DELETE|SELECT/i.test(q.text))
})

test('ordem dos valores bate com a ordem das colunas', () => {
  const v = valores({
    ...BASE,
    bloqueado: true,
    motivoBloqueio: 'tentativa de escrita',
    tokensIn: 120,
    tokensOut: 30,
    latencyMs: 850,
  })
  assert.equal(v[0], 'req-1')
  assert.equal(v[1], 'scope-1')
  assert.equal(v[2], 'quantos leads em julho?')
  assert.equal(v[3], '[]')
  assert.equal(v[4], true)
  assert.equal(v[5], 'tentativa de escrita')
  assert.equal(v[6], 120)
  assert.equal(v[7], 30)
  assert.equal(v[8], 850)
})

test('pergunta é truncada em 2000 chars', () => {
  const v = valores({ ...BASE, pergunta: 'x'.repeat(5000) })
  assert.equal((v[2] as string).length, 2000)
})

test('tools_chamadas guarda a forma da chamada, nunca os dados do cliente', () => {
  const v = valores({
    ...BASE,
    toolsChamadas: [
      {
        tool: 'listar_leads',
        args: { de: '2026-07-01', ate: '2026-07-31' },
        linhas: 2,
        ok: true,
        dados: [{ nome: 'Fulano da Silva', valor_fechado: 900 }],
      },
    ],
  })
  const json = v[3] as string
  assert.match(json, /listar_leads/)
  assert.match(json, /2026-07-01/)
  assert.ok(!json.includes('Fulano'), 'dado de cliente não pode ir para o log')
  assert.deepEqual(JSON.parse(json), [
    { tool: 'listar_leads', args: { de: '2026-07-01', ate: '2026-07-31' }, linhas: 2, ok: true },
  ])
})

test('campos numéricos ausentes ou lixo viram NULL', () => {
  const v = valores({ ...BASE, tokensIn: undefined, tokensOut: NaN as any, latencyMs: '9' as any })
  assert.equal(v[6], null)
  assert.equal(v[7], null)
  assert.equal(v[8], null)
  assert.equal(v[5], null) // motivo_bloqueio ausente
})

test('bloqueado é sempre booleano', () => {
  assert.equal(valores({ ...BASE, bloqueado: 'sim' as any })[4], false)
  assert.equal(valores({ ...BASE, bloqueado: true })[4], true)
})

test('falha de gravação NÃO propaga — a resposta do usuário é mais importante', async () => {
  let chamou = false
  await assert.doesNotReject(
    auditar(BASE, async () => {
      chamou = true
      throw new Error('conexão caiu')
    }),
  )
  assert.equal(chamou, true)
})

test('auditar passa text e values para o executor injetado', async () => {
  const vistos: unknown[][] = []
  await auditar(BASE, async (text, values) => {
    vistos.push([text, values])
  })
  assert.equal(vistos.length, 1)
  assert.match(String(vistos[0]![0]), /assistant_audit_log/)
  assert.equal((vistos[0]![1] as unknown[]).length, 9)
})
