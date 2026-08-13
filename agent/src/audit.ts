// Auditoria do assistente.
//
// Duas decisões que parecem detalhe e não são:
//
// 1. Usa `pool.query` direto, NÃO consultarComoUsuario. A policy de INSERT é
//    `TO prizely_agent_ro WITH CHECK (true)` — não olha claims. Passar por
//    consultarComoUsuario só adicionaria uma transação e um set_config inúteis.
//    O papel tem INSERT e mais nada nessa tabela: não lê, não atualiza, não apaga.
//
// 2. Falha de auditoria NUNCA quebra a resposta do usuário. Log de auditoria é
//    para nós; a resposta é o produto. Todo erro aqui morre no stderr.

import { pool } from './db.js'

const MAX_PERGUNTA = 2000

export interface EventoAuditoria {
  requesterId: string
  scopeUserId: string
  pergunta: string
  toolsChamadas?: unknown[]
  bloqueado: boolean
  motivoBloqueio?: string | null
  tokensIn?: number | null
  tokensOut?: number | null
  latencyMs?: number | null
}

/** Só o que a query precisa — permite injetar um fake no teste sem tocar no pg. */
export type ExecutarInsert = (text: string, values: unknown[]) => Promise<unknown>

const SQL = `INSERT INTO assistant_audit_log
  (requester_id, scope_user_id, pergunta, tools_chamadas, bloqueado,
   motivo_bloqueio, tokens_in, tokens_out, latency_ms)
  VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)`

function inteiroOuNulo(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null
}

/**
 * Monta o INSERT. Puro e exportado para o teste conferir o formato sem banco.
 * A pergunta é truncada: texto colado de WhatsApp chega gigante e o valor de
 * auditoria está no começo dela.
 */
export function montarInsert(e: EventoAuditoria): { text: string; values: unknown[] } {
  const pergunta = typeof e.pergunta === 'string' ? e.pergunta.slice(0, MAX_PERGUNTA) : ''
  return {
    text: SQL,
    values: [
      e.requesterId,
      e.scopeUserId,
      pergunta,
      // Só a forma da chamada. Os `dados` das tools NÃO entram: seriam cópia de
      // dado de cliente num log lido por admin, sem ganho de auditoria.
      JSON.stringify(
        (e.toolsChamadas ?? []).map((c: any) => ({
          tool: c?.tool,
          args: c?.args,
          linhas: c?.linhas ?? 0,
          ok: c?.ok ?? null,
        })),
      ),
      e.bloqueado === true,
      e.motivoBloqueio ?? null,
      inteiroOuNulo(e.tokensIn),
      inteiroOuNulo(e.tokensOut),
      inteiroOuNulo(e.latencyMs),
    ],
  }
}

const padrao: ExecutarInsert = (text, values) => pool.query(text, values)

export async function auditar(e: EventoAuditoria, executar: ExecutarInsert = padrao): Promise<void> {
  try {
    const q = montarInsert(e)
    await executar(q.text, q.values)
  } catch (err) {
    console.error('[audit] falha ao gravar auditoria (resposta segue normal):', err)
  }
}
