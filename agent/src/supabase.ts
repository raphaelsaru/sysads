// Verificação de token e leitura de perfil.
//
// O token é verificado pelo Supabase (não decodificado aqui — assinatura
// conferida no servidor deles). O perfil vem pelo pool read-only, com as claims
// certas para o RLS.

import { createClient } from '@supabase/supabase-js'
import { consultarComoUsuario } from './db.js'
import type { Perfil } from './auth.js'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function verificarToken(token: string): Promise<{ id: string } | null> {
  try {
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data.user) return null
    return { id: data.user.id }
  } catch (e) {
    // Rede caindo não pode virar 500 opaco nem, pior, um "token válido".
    console.error('[supabase] falha ao verificar token:', e)
    return null
  }
}

/**
 * Carrega um perfil. `comoUsuario` é quem "assina" a leitura pro RLS:
 * - perfil próprio -> comoUsuario = o próprio id
 * - perfil do alvo -> comoUsuario = o ADMIN que pediu (a policy
 *   `Users can view own profile` só libera outro id via is_admin())
 *
 * Sem isso o perfil do alvo fica invisível e a impersonação falha com um
 * enganoso "usuário alvo não encontrado".
 */
export async function carregarPerfil(id: string, comoUsuario = id): Promise<Perfil | null> {
  const r = await consultarComoUsuario<Perfil>(
    comoUsuario,
    `SELECT role::text AS role, coalesce(preferences, '{}'::jsonb) AS preferences
     FROM user_profiles WHERE id = $1`,
    [id],
  )
  return r.rows[0] ?? null
}
