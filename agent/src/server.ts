// Servidor do assistente. Roda na VPS, atrás do Traefik.
//
// TRÊS TRAVAS, NESTA ORDEM — a ordem é a feature:
//   1. segredo compartilhado: o endpoint é público, e sem isso qualquer um
//      queima crédito de OpenRouter. É a PRIMEIRA coisa, antes de qualquer
//      trabalho — antes de validar token, antes de tocar no banco.
//   2. escopo: token verificado -> scopeUserId. Resolvido ANTES do LLM existir.
//   3. guard de entrada: recusa barata para lixo óbvio.
//
// RESPOSTA É JSON, NÃO SSE, DE PROPÓSITO. Streaming é incompatível com a trava
// antialucinação do llm.ts: uma resposta com número e sem consulta é REJEITADA e
// refeita, e não existe "des-enviar" token já transmitido. Streaming aqui
// significaria o usuário ver o número inventado antes da correção. Não "conserte"
// isso trocando por SSE sem antes resolver o retry.

import { pathToFileURL } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { resolveScope, type AuthDeps } from './auth.js'
import { checarEntrada } from './guard.js'
import { responder, type LLMDeps } from './llm.js'
import { executarTool } from './tools/executor.js'
import { verificarToken, carregarPerfil } from './supabase.js'
import { auditar, type EventoAuditoria } from './audit.js'
import { zonaValida } from './tempo.js'

const LIMITE_CORPO = 32 * 1024
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface ServidorDeps {
  verificarToken: AuthDeps['verificarToken']
  carregarPerfil: AuthDeps['carregarPerfil']
  chamarOpenRouter: LLMDeps['chamarOpenRouter']
  executarTool: LLMDeps['executarTool']
  auditar: (e: EventoAuditoria) => Promise<void>
  segredo: () => string | undefined
}

async function chamarOpenRouterReal(corpo: unknown): Promise<any> {
  const r = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
      'content-type': 'application/json',
      'x-title': 'Prizely',
    },
    body: JSON.stringify(corpo),
  })
  if (!r.ok) {
    throw new Error(`openrouter ${r.status}: ${(await r.text()).slice(0, 300)}`)
  }
  return r.json()
}

const PADROES: ServidorDeps = {
  verificarToken,
  carregarPerfil,
  chamarOpenRouter: chamarOpenRouterReal,
  executarTool: (tool, args, scopeUserId) => executarTool(tool, args, scopeUserId),
  auditar: (e) => auditar(e),
  segredo: () => process.env.PRIZELY_SHARED_SECRET,
}

function tokenDoHeader(h: unknown): string {
  if (typeof h !== 'string') return ''
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m?.[1]?.trim() ?? ''
}

function textoNaoVazio(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

export async function construirServidor(
  parciais: Partial<ServidorDeps> = {},
): Promise<FastifyInstance> {
  const deps: ServidorDeps = { ...PADROES, ...parciais }
  const app = Fastify({ logger: false, bodyLimit: LIMITE_CORPO })

  // 60/hora por IP. O custo real é o OpenRouter, não a CPU.
  await app.register(rateLimit, { max: 60, timeWindow: '1 hour' })

  app.get('/health', async () => ({ ok: true }))

  app.post('/chat', async (req, reply) => {
    const inicio = Date.now()

    // ---- TRAVA 1: segredo compartilhado, antes de qualquer outro trabalho.
    const esperado = deps.segredo()
    const enviado = req.headers['x-prizely-secret']
    // Falha fechada: segredo não configurado => ninguém entra.
    if (!textoNaoVazio(esperado) || enviado !== esperado) {
      return reply.code(401).send({ erro: 'não autorizado' })
    }

    const corpo = (req.body ?? {}) as Record<string, unknown>
    const pergunta = typeof corpo.pergunta === 'string' ? corpo.pergunta : ''
    const impersonateUserId = textoNaoVazio(corpo.impersonateUserId)
      ? corpo.impersonateUserId.trim()
      : undefined
    // Zona inválida não é erro de request: cai no padrão pt-BR silenciosamente.
    const timezone = zonaValida(corpo.timezone) ? corpo.timezone : undefined

    const token = tokenDoHeader(req.headers.authorization)
    if (token === '') return reply.code(401).send({ erro: 'token ausente' })

    // ---- TRAVA 2: de quem são os dados. Antes do LLM entrar em cena.
    const escopo = await resolveScope(
      { token, impersonateUserId },
      { verificarToken: deps.verificarToken, carregarPerfil: deps.carregarPerfil },
    )
    if (!escopo.ok) {
      // Sem auditoria: resolveScope não devolve ids quando falha, e as duas
      // colunas são NOT NULL com FK para auth.users — um insert aqui quebraria.
      console.warn(`[chat] escopo negado (${escopo.status}): ${escopo.motivo}`)
      return reply.code(escopo.status).send({ erro: escopo.motivo })
    }

    // ---- TRAVA 3: guard de entrada. Recusa é resposta de produto, não erro.
    const check = checarEntrada(pergunta)
    if (!check.ok) {
      await deps.auditar({
        requesterId: escopo.requesterId,
        scopeUserId: escopo.scopeUserId,
        pergunta,
        bloqueado: true,
        motivoBloqueio: check.motivo,
        latencyMs: Date.now() - inicio,
      })
      return reply.code(200).send({ texto: check.resposta, toolsChamadas: [], bloqueado: true })
    }

    try {
      const r = await responder(
        pergunta,
        {
          scopeUserId: escopo.scopeUserId,
          currency: escopo.currency,
          impersonando: escopo.impersonando,
          role: escopo.role,
          timezone,
        },
        { chamarOpenRouter: deps.chamarOpenRouter, executarTool: deps.executarTool },
      )

      await deps.auditar({
        requesterId: escopo.requesterId,
        scopeUserId: escopo.scopeUserId,
        pergunta,
        toolsChamadas: r.toolsChamadas,
        bloqueado: false,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        latencyMs: Date.now() - inicio,
      })

      // toolsChamadas leva os `dados` reais: é o rodapé de proveniência da UI.
      return reply.code(200).send({
        texto: r.texto,
        toolsChamadas: r.toolsChamadas,
        bloqueado: false,
      })
    } catch (e) {
      console.error('[chat] falha ao responder:', e)
      await deps.auditar({
        requesterId: escopo.requesterId,
        scopeUserId: escopo.scopeUserId,
        pergunta,
        bloqueado: false,
        motivoBloqueio: 'erro interno',
        latencyMs: Date.now() - inicio,
      })
      return reply.code(500).send({ erro: 'falha ao responder' })
    }
  })

  return app
}

// Só sobe servidor quando executado direto (`node dist/server.js` / `tsx src/server.ts`),
// nunca quando importado por teste.
const executadoDireto =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (executadoDireto) {
  if (!textoNaoVazio(process.env.PRIZELY_SHARED_SECRET)) {
    console.error('PRIZELY_SHARED_SECRET não configurado — recusando subir.')
    process.exit(1)
  }
  const porta = Number(process.env.PORT ?? 3030)
  const app = await construirServidor()
  app
    .listen({ host: '0.0.0.0', port: porta })
    .then(() => console.log(`prizely-agent ouvindo em 0.0.0.0:${porta}`))
    .catch((e) => {
      console.error('falha ao subir:', e)
      process.exit(1)
    })
}
