// Acesso ao banco pelo papel read-only `prizely_agent_ro`.
//
// O RLS de `clientes` é `(user_id = auth.uid()) OR is_admin()` e vale para o
// papel `public` — ou seja, vale para nós. Numa conexão crua auth.uid() é NULL
// e NENHUMA linha aparece. Por isso toda leitura passa por
// consultarComoUsuario(), que injeta as claims na transação.

import pg from 'pg'

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  statement_timeout: 5_000,
  application_name: 'prizely-agent',
})

/**
 * Roda uma query com as claims JWT do usuário informado, dentro de uma
 * transação. Sem isso o RLS esconde todas as linhas (auth.uid() = NULL).
 * `comoUsuario` alimenta o RLS; NÃO substitui o WHERE user_id explícito —
 * para admin o RLS é no-op (is_admin() = true) e só o WHERE segura o escopo.
 */
export async function consultarComoUsuario<T = any>(
  comoUsuario: string,
  text: string,
  values: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Parametrizado: o uuid nunca é concatenado no SQL.
    await client.query('SELECT set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: comoUsuario, role: 'authenticated' }),
    ])
    const r = await client.query(text, values)
    await client.query('COMMIT')
    return { rows: r.rows, rowCount: r.rowCount ?? 0 }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
