import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarArgs } from '../src/tools/validar.ts'

// Período válido reaproveitado: os testes de tool não devem falhar por causa da data.
const P = { de: '2026-01-01', ate: '2026-01-31' }

test('período válido passa', () => {
  const r = validarArgs('contar_leads', { ...P })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.args.de, '2026-01-01')
  assert.equal(r.args.ate, '2026-01-31')
})

test('data malformada é rejeitada', () => {
  for (const de of ['01/01/2026', '2026-1-1', '20260101', '2026-01-01T00:00:00Z', '']) {
    const r = validarArgs('contar_leads', { de, ate: '2026-01-31' })
    assert.equal(r.ok, false, `deveria rejeitar ${JSON.stringify(de)}`)
  }
})

test('SQL na data é rejeitado', () => {
  const r = validarArgs('contar_leads', {
    de: "2026-01-01'; DROP TABLE clientes;--",
    ate: '2026-01-31',
  })
  assert.equal(r.ok, false)

  const r2 = validarArgs('contar_leads', {
    de: '2026-01-01',
    ate: "2026-01-31' OR '1'='1",
  })
  assert.equal(r2.ok, false)
})

test('data inexistente é rejeitada', () => {
  // new Date('2026-02-30T00:00:00Z') NÃO é NaN: rola para 02/03. Round-trip pega.
  for (const de of ['2026-02-30', '2026-13-01', '2026-00-10', '2025-02-29', '2026-04-31']) {
    const r = validarArgs('contar_leads', { de, ate: '2026-12-31' })
    assert.equal(r.ok, false, `deveria rejeitar ${de}`)
  }
})

test('de depois de ate é rejeitado', () => {
  const r = validarArgs('contar_leads', { de: '2026-03-01', ate: '2026-02-01' })
  assert.equal(r.ok, false)
  // Mesmo dia é válido.
  assert.equal(validarArgs('contar_leads', { de: '2026-03-01', ate: '2026-03-01' }).ok, true)
})

test('período absurdo é rejeitado', () => {
  const r = validarArgs('contar_leads', { de: '1900-01-01', ate: '2200-01-01' })
  assert.equal(r.ok, false)
})

test('tool desconhecida é rejeitada', () => {
  for (const t of ['deletar_tudo', '', 'CONTAR_LEADS', 'toString', '__proto__']) {
    const r = validarArgs(t, { ...P })
    assert.equal(r.ok, false, `deveria rejeitar tool ${t}`)
  }
})

test('tool desconhecida é rejeitada antes de qualquer outra validação', () => {
  // Não deve vazar "data inválida" quando o problema real é a tool.
  const r = validarArgs('deletar_tudo', { de: 'lixo', ate: 'lixo' })
  assert.equal(r.ok, false)
  assert.match(r.ok === false ? r.motivo : '', /tool/i)
})

test('argumentos não-objeto são rejeitados', () => {
  for (const bruto of [null, undefined, 'de=2026-01-01', 42, true, [P]]) {
    const r = validarArgs('contar_leads', bruto)
    assert.equal(r.ok, false, `deveria rejeitar ${JSON.stringify(bruto ?? null)}`)
  }
  // Array COM de/ate: typeof === 'object', então só o Array.isArray barra.
  const arrayComDatas = Object.assign([], P)
  assert.equal(validarArgs('contar_leads', arrayComDatas).ok, false)
})

test('user_id passado pelo LLM é ignorado, nunca propagado', () => {
  const r = validarArgs('contar_leads', { ...P, user_id: 'outro-usuario' })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(Object.hasOwn(r.args, 'user_id'), false)
  assert.equal(JSON.stringify(r.args).includes('outro-usuario'), false)
})

test('campos extras do LLM não vazam para args em nenhuma tool', () => {
  const lixo = {
    user_id: 'x', tenant_id: 'y', table: 'clientes',
    select: '*', where: '1=1', scopeUserId: 'z', limit: 9999,
    // __proto__ como propriedade PRÓPRIA (literal setaria o protótipo, não uma chave).
    ...(JSON.parse('{"__proto__":{"poluido":true}}') as Record<string, unknown>),
  }
  const casos: Array<[string, Record<string, unknown>]> = [
    ['contar_leads', { ...P, ...lixo }],
    ['listar_leads', { ...P, ...lixo }],
    ['agregar_metricas', { ...P, metricas: ['leads'], ...lixo }],
  ]
  for (const [tool, bruto] of casos) {
    const r = validarArgs(tool, bruto)
    assert.equal(r.ok, true, `${tool} deveria passar`)
    if (!r.ok) continue
    for (const k of ['user_id', 'tenant_id', 'table', 'select', 'where', 'scopeUserId', 'limit']) {
      assert.equal(Object.hasOwn(r.args, k), false, `${tool} vazou ${k}`)
    }
    assert.equal((r.args as Record<string, unknown>).poluido, undefined)
    assert.equal(({} as Record<string, unknown>).poluido, undefined, 'protótipo poluído')
  }
})

test('métrica inventada é rejeitada', () => {
  const r = validarArgs('agregar_metricas', { ...P, metricas: ['salario_do_ceo'] })
  assert.equal(r.ok, false)
  // Mistura de válida + inventada também cai.
  const r2 = validarArgs('agregar_metricas', { ...P, metricas: ['leads', 'salario_do_ceo'] })
  assert.equal(r2.ok, false)
  // Não-strings na lista também.
  const r3 = validarArgs('agregar_metricas', { ...P, metricas: ['leads', 1] })
  assert.equal(r3.ok, false)
})

test('métricas válidas passam', () => {
  const r = validarArgs('agregar_metricas', { ...P, metricas: ['leads', 'faturamento'] })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(r.args.metricas, ['leads', 'faturamento'])
})

test('metricas vazio é rejeitado', () => {
  assert.equal(validarArgs('agregar_metricas', { ...P, metricas: [] }).ok, false)
})

test('metricas não-array é rejeitado', () => {
  for (const metricas of ['leads', 1, null, undefined, { 0: 'leads' }]) {
    const r = validarArgs('agregar_metricas', { ...P, metricas })
    assert.equal(r.ok, false, `deveria rejeitar metricas=${JSON.stringify(metricas ?? null)}`)
  }
})

test('agrupamento inventado é rejeitado', () => {
  for (const agrupar_por of ['user_id', 'mes; DROP TABLE clientes', '', 1, {}, ['mes']]) {
    const r = validarArgs('agregar_metricas', { ...P, metricas: ['leads'], agrupar_por })
    assert.equal(r.ok, false, `deveria rejeitar ${JSON.stringify(agrupar_por)}`)
  }
})

test('agrupar_por null/undefined conta como ausente', () => {
  for (const agrupar_por of [null, undefined]) {
    const r = validarArgs('agregar_metricas', { ...P, metricas: ['leads'], agrupar_por })
    assert.equal(r.ok === true && r.args.agrupar_por, 'nenhum')
  }
})

test("agrupar_por ausente vira 'nenhum'", () => {
  const r = validarArgs('agregar_metricas', { ...P, metricas: ['leads'] })
  assert.equal(r.ok, true)
  assert.equal(r.ok === true && r.args.agrupar_por, 'nenhum')
})

test('agrupamento válido é preservado', () => {
  const r = validarArgs('agregar_metricas', { ...P, metricas: ['leads'], agrupar_por: 'origem' })
  assert.equal(r.ok === true && r.args.agrupar_por, 'origem')
})

test('ordenar_por fora da allowlist é rejeitado', () => {
  for (const ordenar_por of ['nome; DROP TABLE clientes', 'user_id', '', 1, {}, ['data_contato']]) {
    const r = validarArgs('listar_leads', { ...P, ordenar_por })
    assert.equal(r.ok, false, `deveria rejeitar ${JSON.stringify(ordenar_por)}`)
  }
})

test('ordenar_por null/undefined conta como ausente', () => {
  for (const ordenar_por of [null, undefined]) {
    const r = validarArgs('listar_leads', { ...P, ordenar_por })
    assert.equal(r.ok === true && r.args.ordenar_por, 'data_contato')
  }
})

test('ordenar_por válido é preservado, ausente vira data_contato', () => {
  const r = validarArgs('listar_leads', { ...P, ordenar_por: 'valor_fechado' })
  assert.equal(r.ok === true && r.args.ordenar_por, 'valor_fechado')
  const r2 = validarArgs('listar_leads', { ...P })
  assert.equal(r2.ok === true && r2.args.ordenar_por, 'data_contato')
})

test('ordem inválida cai para desc', () => {
  for (const ordem of ['DROP', 'ASC', 'asc; --', 1, null, undefined]) {
    const r = validarArgs('listar_leads', { ...P, ordem })
    assert.equal(r.ok, true)
    assert.equal(r.ok === true && r.args.ordem, 'desc', `ordem=${JSON.stringify(ordem)}`)
  }
  const r = validarArgs('listar_leads', { ...P, ordem: 'asc' })
  assert.equal(r.ok === true && r.args.ordem, 'asc')
})

test('limite acima do teto é cortado, não rejeitado', () => {
  const r = validarArgs('listar_leads', { ...P, limite: 5000 })
  assert.equal(r.ok, true)
  assert.equal(r.ok === true && r.args.limite, 50)
})

test('limite hostil vira número seguro', () => {
  const casos: Array<[unknown, number]> = [
    [undefined, 20],
    [0, 1],
    [-10, 1],
    ['10', 10],
    ['10; DROP TABLE clientes', 20],
    [7.9, 7],
    [Infinity, 20],
    [NaN, 20],
    [null, 20],
    [{}, 20],
  ]
  for (const [limite, esperado] of casos) {
    const r = validarArgs('listar_leads', { ...P, limite })
    assert.equal(r.ok, true, `limite=${JSON.stringify(limite ?? null)}`)
    assert.equal(r.ok === true && r.args.limite, esperado, `limite=${String(limite)}`)
    assert.equal(typeof (r.ok === true && r.args.limite), 'number')
  }
})

test('filtros válidos são copiados', () => {
  const r = validarArgs('contar_leads', {
    ...P,
    resultado: 'Venda',
    origem: 'Instagram',
    categoria: 'Victor',
    venda_paga: true,
    nao_respondeu: false,
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(r.args, {
    de: P.de,
    ate: P.ate,
    resultado: 'Venda',
    origem: 'Instagram',
    categoria: 'Victor',
    venda_paga: true,
    nao_respondeu: false,
  })
})

test('filtros de tipo errado são descartados, não aceitos', () => {
  const r = validarArgs('contar_leads', {
    ...P,
    venda_paga: 'sim',
    nao_respondeu: 1,
    origem: { $ne: null },
    categoria: ['Victor'],
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  for (const k of ['venda_paga', 'nao_respondeu', 'origem', 'categoria']) {
    assert.equal(Object.hasOwn(r.args, k), false, `${k} não deveria estar em args`)
  }
})

test('resultado fora da allowlist é descartado', () => {
  const r = validarArgs('contar_leads', { ...P, resultado: "Venda' OR 1=1--" })
  assert.equal(r.ok, true)
  assert.equal(r.ok === true && Object.hasOwn(r.args, 'resultado'), false)
})

test('origem gigante é descartada', () => {
  const r = validarArgs('contar_leads', { ...P, origem: 'x'.repeat(61) })
  assert.equal(r.ok, true)
  assert.equal(r.ok === true && Object.hasOwn(r.args, 'origem'), false)
  // 60 caracteres ainda passam.
  const r2 = validarArgs('contar_leads', { ...P, origem: 'x'.repeat(60) })
  assert.equal(r2.ok === true && r2.args.origem, 'x'.repeat(60))
})

test('agregar_metricas não carrega filtros nem ordenação', () => {
  const r = validarArgs('agregar_metricas', {
    ...P,
    metricas: ['leads'],
    resultado: 'Venda',
    limite: 50,
    ordenar_por: 'valor_fechado',
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(Object.keys(r.args).sort(), ['agrupar_por', 'ate', 'de', 'metricas'])
})

test('contar_leads não carrega ordenação nem limite', () => {
  const r = validarArgs('contar_leads', { ...P, ordenar_por: 'valor_fechado', limite: 50 })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(Object.keys(r.args).sort(), ['ate', 'de'])
})

test('args são strings limpas, não objetos com toString', () => {
  // Um objeto com toString malicioso não pode virar `de`.
  const r = validarArgs('contar_leads', {
    de: { toString: () => '2026-01-01' },
    ate: '2026-01-31',
  })
  assert.equal(r.ok, false)
})
