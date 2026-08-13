import { test } from 'node:test'
import assert from 'node:assert/strict'
import { responder, type LLMDeps, type EscopoLLM } from '../src/llm.ts'
import type { ResultadoTool } from '../src/tools/executor.ts'
import { systemPrompt } from '../src/prompt.ts'

const ESCOPO: EscopoLLM = {
  scopeUserId: 'user-dono',
  currency: 'BRL',
  impersonando: false,
}

interface ChamadaFake {
  name: string
  /** JSON cru, como o modelo devolve. */
  arguments: string
}

function respostaTexto(content: unknown, usage?: unknown) {
  return { choices: [{ message: { role: 'assistant', content } }], usage }
}

function respostaTools(chamadas: ChamadaFake[], usage?: unknown) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: chamadas.map((c, i) => ({
            id: `call_${i}`,
            type: 'function',
            function: { name: c.name, arguments: c.arguments },
          })),
        },
      },
    ],
    usage,
  }
}

/** Fila de respostas; a última se repete se a fila acabar. */
function filaLLM(respostas: unknown[]) {
  const corpos: any[] = []
  const chamar = async (corpo: unknown) => {
    corpos.push(corpo)
    return respostas[Math.min(corpos.length - 1, respostas.length - 1)]
  }
  return { chamar, corpos }
}

function executorFake(
  resultado: ResultadoTool = { ok: true, tool: 'contar_leads', linhas: 1, dados: [{ total: 42 }], janela: 'contato', truncado: false },
) {
  const recebidas: Array<{ tool: string; args: unknown; escopo: string }> = []
  const executar = async (tool: string, args: unknown, scopeUserId: string) => {
    recebidas.push({ tool, args, escopo: scopeUserId })
    return { ...resultado, tool }
  }
  return { executar, recebidas }
}

function deps(chamar: LLMDeps['chamarOpenRouter'], executar: LLMDeps['executarTool']): LLMDeps {
  return { chamarOpenRouter: chamar, executarTool: executar }
}

// ---------------------------------------------------------------- trava antialucinação

test('resposta com número sem nenhuma tool chamada é rejeitada e o modelo tenta de novo', async () => {
  const llm = filaLLM([
    respostaTexto('Você teve 137 leads em julho.'),
    respostaTools([{ name: 'contar_leads', arguments: '{"de":"2026-07-01","ate":"2026-07-31"}' }]),
    respostaTexto('Foram 42 leads em julho.'),
  ])
  const ex = executorFake()

  const r = await responder('quantos leads em julho?', ESCOPO, deps(llm.chamar, ex.executar))

  assert.equal(r.texto, 'Foram 42 leads em julho.')
  assert.equal(r.toolsChamadas.length, 1)
  // A resposta fabricada nunca vaza.
  assert.ok(!r.texto.includes('137'))
  // Houve uma mensagem de correção injetada antes da segunda volta.
  const segundaCorpo = llm.corpos[1] as any
  const temCorrecao = segundaCorpo.messages.some(
    (m: any) => m.role === 'system' && /função|consultar/i.test(String(m.content)),
  )
  assert.ok(temCorrecao, 'esperava mensagem de correção do gate')
})

test('resposta sem dígitos e sem tool passa direto (recusa off-topic legítima)', async () => {
  const llm = filaLLM([respostaTexto('Só consigo responder perguntas sobre os seus dados do CRM.')])
  const ex = executorFake()

  const r = await responder('qual a capital da França?', ESCOPO, deps(llm.chamar, ex.executar))

  assert.equal(r.texto, 'Só consigo responder perguntas sobre os seus dados do CRM.')
  assert.equal(r.toolsChamadas.length, 0)
  assert.equal(llm.corpos.length, 1, 'não deveria ter havido segunda volta')
  assert.equal(ex.recebidas.length, 0)
})

test('resposta com número DEPOIS de tool chamada passa', async () => {
  const llm = filaLLM([
    respostaTools([{ name: 'contar_leads', arguments: '{"de":"2026-07-01","ate":"2026-07-31"}' }]),
    respostaTexto('42 leads.'),
  ])
  const ex = executorFake()

  const r = await responder('quantos leads?', ESCOPO, deps(llm.chamar, ex.executar))
  assert.equal(r.texto, '42 leads.')
  assert.equal(r.toolsChamadas.length, 1)
})

// ---------------------------------------------------------------- loop de tools

test('tool é executada e o resultado chega ao modelo', async () => {
  const llm = filaLLM([
    respostaTools([{ name: 'contar_leads', arguments: '{"de":"2026-07-01","ate":"2026-07-31"}' }]),
    respostaTexto('42 leads em julho.'),
  ])
  const ex = executorFake()

  const r = await responder('quantos leads em julho?', ESCOPO, deps(llm.chamar, ex.executar))

  assert.equal(ex.recebidas.length, 1)
  assert.equal(ex.recebidas[0]!.tool, 'contar_leads')
  assert.deepEqual(ex.recebidas[0]!.args, { de: '2026-07-01', ate: '2026-07-31' })

  const segundaCorpo = llm.corpos[1] as any
  const msgTool = segundaCorpo.messages.find((m: any) => m.role === 'tool')
  assert.ok(msgTool, 'esperava mensagem role=tool')
  assert.equal(msgTool.tool_call_id, 'call_0')
  const conteudo = JSON.parse(msgTool.content)
  assert.equal(conteudo.resultado.linhas, 1)
  assert.deepEqual(conteudo.resultado.dados, [{ total: 42 }])
  assert.equal(conteudo.resultado.janela, 'contato')
  // O aviso de que conteúdo de banco é dado, não instrução.
  assert.match(JSON.stringify(conteudo), /instru/i)

  assert.deepEqual(r.toolsChamadas, [
    { tool: 'contar_leads', args: { de: '2026-07-01', ate: '2026-07-31' }, linhas: 1 },
  ])
})

test('SEGURANÇA: escopo passado ao executor é sempre o do token, mesmo com user_id nos args', async () => {
  const llm = filaLLM([
    respostaTools([
      {
        name: 'contar_leads',
        arguments: '{"de":"2026-07-01","ate":"2026-07-31","user_id":"INVASOR","scopeUserId":"INVASOR"}',
      },
    ]),
    respostaTexto('42 leads.'),
  ])
  const ex = executorFake()

  await responder('quantos leads do outro usuário?', ESCOPO, deps(llm.chamar, ex.executar))

  assert.equal(ex.recebidas.length, 1)
  assert.equal(ex.recebidas[0]!.escopo, 'user-dono')
  assert.notEqual(ex.recebidas[0]!.escopo, 'INVASOR')
})

test('várias tools na mesma volta são todas executadas', async () => {
  const llm = filaLLM([
    respostaTools([
      { name: 'contar_leads', arguments: '{"de":"2026-06-01","ate":"2026-06-30"}' },
      { name: 'contar_leads', arguments: '{"de":"2026-07-01","ate":"2026-07-31"}' },
      { name: 'agregar_metricas', arguments: '{"de":"2026-07-01","ate":"2026-07-31","metricas":["vendas"]}' },
    ]),
    respostaTexto('Junho 42, julho 42.'),
  ])
  const ex = executorFake()

  const r = await responder('compare junho e julho', ESCOPO, deps(llm.chamar, ex.executar))

  assert.equal(ex.recebidas.length, 3)
  assert.equal(r.toolsChamadas.length, 3)
  assert.ok(ex.recebidas.every((c) => c.escopo === 'user-dono'))

  const segundaCorpo = llm.corpos[1] as any
  const tools = segundaCorpo.messages.filter((m: any) => m.role === 'tool')
  assert.equal(tools.length, 3)
  assert.deepEqual(
    tools.map((m: any) => m.tool_call_id),
    ['call_0', 'call_1', 'call_2'],
  )
})

test('loop é limitado: modelo que só pede tool termina sem estourar', async () => {
  const llm = filaLLM([respostaTools([{ name: 'contar_leads', arguments: '{"de":"2026-07-01","ate":"2026-07-31"}' }])])
  const ex = executorFake()

  const r = await responder('quantos leads?', ESCOPO, deps(llm.chamar, ex.executar))

  assert.ok(llm.corpos.length <= 6, `voltas demais: ${llm.corpos.length}`)
  assert.ok(r.texto.length > 0)
  assert.ok(!/\d/.test(r.texto), 'a resposta de desistência não pode conter número')
})

test('gate repetido também termina sem fabricar número', async () => {
  const llm = filaLLM([respostaTexto('Você teve 999 leads.')])
  const ex = executorFake()

  const r = await responder('quantos leads?', ESCOPO, deps(llm.chamar, ex.executar))

  assert.ok(llm.corpos.length <= 6)
  assert.ok(!r.texto.includes('999'))
  assert.equal(ex.recebidas.length, 0)
})

// ---------------------------------------------------------------- robustez

test('arguments com JSON inválido não estoura — vira {}', async () => {
  const llm = filaLLM([
    respostaTools([{ name: 'contar_leads', arguments: '{de: julho' }]),
    respostaTexto('Não consegui interpretar o período.'),
  ])
  const ex = executorFake({ ok: false, tool: 'contar_leads', erro: 'argumentos inválidos' })

  const r = await responder('quantos leads?', ESCOPO, deps(llm.chamar, ex.executar))

  assert.equal(ex.recebidas.length, 1)
  assert.deepEqual(ex.recebidas[0]!.args, {})
  assert.equal(r.texto, 'Não consegui interpretar o período.')
})

test('tool com ok:false volta ao modelo em vez de estourar', async () => {
  const llm = filaLLM([
    respostaTools([{ name: 'agregar_metricas', arguments: '{"de":"2026-07-01","ate":"2026-07-31","metricas":["vendas"]}' }]),
    respostaTexto('Não consegui consultar os dados agora.'),
  ])
  const ex = executorFake({ ok: false, tool: 'agregar_metricas', erro: 'falha ao consultar os dados' })

  const r = await responder('faturamento de julho?', ESCOPO, deps(llm.chamar, ex.executar))

  const segundaCorpo = llm.corpos[1] as any
  const msgTool = segundaCorpo.messages.find((m: any) => m.role === 'tool')
  const conteudo = JSON.parse(msgTool.content)
  assert.equal(conteudo.resultado.ok, false)
  assert.equal(conteudo.resultado.erro, 'falha ao consultar os dados')
  assert.equal(r.texto, 'Não consegui consultar os dados agora.')
  assert.equal(r.toolsChamadas[0]!.linhas, 0)
})

test('resposta malformada do provedor não estoura', async () => {
  for (const ruim of [{}, null, { choices: [] }, { choices: [{}] }, { choices: [{ message: {} }] }, 'texto solto']) {
    const llm = filaLLM([ruim])
    const ex = executorFake()
    const r = await responder('quantos leads?', ESCOPO, deps(llm.chamar, ex.executar))
    assert.equal(typeof r.texto, 'string')
    assert.ok(r.texto.length > 0)
  }
})

test('erro do executor não derruba a volta', async () => {
  const llm = filaLLM([
    respostaTools([{ name: 'contar_leads', arguments: '{"de":"2026-07-01","ate":"2026-07-31"}' }]),
    respostaTexto('Não consegui consultar os dados agora.'),
  ])
  const executar = async () => {
    throw new Error('boom')
  }
  const r = await responder('quantos leads?', ESCOPO, deps(llm.chamar, executar as any))
  assert.equal(r.texto, 'Não consegui consultar os dados agora.')
})

// ---------------------------------------------------------------- contabilidade

test('tokens somam entre as voltas', async () => {
  const llm = filaLLM([
    respostaTools([{ name: 'contar_leads', arguments: '{"de":"2026-07-01","ate":"2026-07-31"}' }], {
      prompt_tokens: 100,
      completion_tokens: 20,
    }),
    respostaTexto('42 leads.', { prompt_tokens: 150, completion_tokens: 10 }),
  ])
  const ex = executorFake()

  const r = await responder('quantos leads?', ESCOPO, deps(llm.chamar, ex.executar))
  assert.equal(r.tokensIn, 250)
  assert.equal(r.tokensOut, 30)
})

test('usage ausente ou lixo conta como zero', async () => {
  const llm = filaLLM([respostaTexto('Só falo dos seus dados do CRM.', { prompt_tokens: 'muitos' })])
  const ex = executorFake()
  const r = await responder('oi', ESCOPO, deps(llm.chamar, ex.executar))
  assert.equal(r.tokensIn, 0)
  assert.equal(r.tokensOut, 0)
})

// ---------------------------------------------------------------- corpo da requisição

test('corpo enviado tem tools, temperature 0 e system prompt', async () => {
  const llm = filaLLM([respostaTexto('Só falo dos seus dados do CRM.')])
  const ex = executorFake()
  await responder('quem é você?', ESCOPO, deps(llm.chamar, ex.executar))

  const corpo = llm.corpos[0] as any
  assert.equal(corpo.temperature, 0)
  assert.ok(Array.isArray(corpo.tools) && corpo.tools.length === 3)
  assert.equal(corpo.messages[0].role, 'system')
  assert.equal(corpo.messages[1].role, 'user')
  assert.equal(corpo.messages[1].content, 'quem é você?')
})

// ---------------------------------------------------------------- prompt

test('systemPrompt cobre janelas, janela/truncado e formatação', () => {
  const p = systemPrompt({ currency: 'BRL', hoje: '2026-08-13', impersonando: false })
  assert.match(p, /data_contato/)
  assert.match(p, /data_mes_venda/)
  assert.match(p, /truncado/)
  assert.match(p, /janela/)
  assert.match(p, /R\$/)
  assert.match(p, /2026-08-13/)
  assert.ok(!/impersona/i.test(p), 'sem impersonação não deve falar em impersonação')
})

test('systemPrompt marca sessão de impersonação e traduz a moeda', () => {
  const p = systemPrompt({ currency: 'USD', hoje: '2026-08-13', impersonando: true })
  assert.match(p, /US\$/)
  assert.match(p, /admin/i)
  const e = systemPrompt({ currency: 'EUR', hoje: '2026-08-13', impersonando: false })
  assert.match(e, /€/)
  const x = systemPrompt({ currency: 'XPTO', hoje: '2026-08-13', impersonando: false })
  assert.match(x, /XPTO/)
})
