// Execução de uma tool: valida -> monta SQL -> consulta com o escopo.
//
// Tudo que o modelo vê dos dados passa por aqui. Duas regras:
//  - erro do Postgres nunca chega ao LLM (vaza nome de tabela, coluna, tipo);
//  - o resultado carrega o que o modelo não consegue deduzir sozinho: qual
//    janela de data delimitou o período e se a resposta veio truncada.

import { consultarComoUsuario } from '../db.js'
import { validarArgs } from './validar.js'
import { montarSQL } from './sql.js'

export interface ResultadoTool {
  ok: boolean
  tool: string
  linhas?: number
  dados?: unknown[]
  janela?: 'contato' | 'venda' | 'ambas'
  truncado?: boolean
  erro?: string
}

// Injetável só para teste; em produção é sempre o consultarComoUsuario real.
export type Consultar = typeof consultarComoUsuario

export async function executarTool(
  tool: string,
  argsBrutos: unknown,
  scopeUserId: string,
  consultar: Consultar = consultarComoUsuario,
): Promise<ResultadoTool> {
  const v = validarArgs(tool, argsBrutos)
  if (!v.ok) return { ok: false, tool, erro: v.motivo }

  try {
    const q = montarSQL(tool, v.args, scopeUserId)
    // Duas camadas com o MESMO escopo: RLS via claims + WHERE user_id = $1.
    const r = await consultar(scopeUserId, q.text, q.values)

    // Bater no teto não PROVA truncamento (pode ter exatamente N linhas), mas
    // subestimar a completude é o lado seguro do erro: melhor o modelo dizer
    // "pode haver mais" do que apresentar uma lista cortada como o total.
    const truncado = q.limite !== null && r.rowCount >= q.limite

    return { ok: true, tool, linhas: r.rowCount, dados: r.rows, janela: q.janela, truncado }
  } catch (e) {
    // Nunca devolva a mensagem crua do Postgres ao LLM — vaza estrutura do schema.
    console.error(`[executor] ${tool} falhou:`, e)
    return { ok: false, tool, erro: 'falha ao consultar os dados' }
  }
}
