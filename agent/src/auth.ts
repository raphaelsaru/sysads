// Resolução de escopo: decide de QUEM são os dados antes de o LLM entrar em cena.
// Nenhuma ferramenta do agente aceita user_id; tudo vem do scopeUserId daqui.

export type Escopo =
  | { ok: true; requesterId: string; scopeUserId: string; impersonando: boolean; currency: string }
  | { ok: false; status: 401 | 403; motivo: string }

export interface Perfil {
  role: string
  preferences: Record<string, unknown>
}

export interface AuthDeps {
  verificarToken: (token: string) => Promise<{ id: string } | null>
  // comoUsuario = claims usadas na leitura (RLS: id = auth.uid() OR is_admin()).
  carregarPerfil: (id: string, comoUsuario?: string) => Promise<Perfil | null>
}

export interface PedidoEscopo {
  token: string
  impersonateUserId?: string
}

const MOEDAS = new Set(['BRL', 'USD', 'EUR'])

function moedaDe(p: Perfil): string {
  const c = p.preferences?.currency
  return typeof c === 'string' && MOEDAS.has(c) ? c : 'BRL'
}

export async function resolveScope(pedido: PedidoEscopo, deps: AuthDeps): Promise<Escopo> {
  const usuario = await deps.verificarToken(pedido.token)
  if (!usuario) return { ok: false, status: 401, motivo: 'token inválido' }

  const requester = await deps.carregarPerfil(usuario.id)
  if (!requester) return { ok: false, status: 401, motivo: 'perfil não encontrado' }

  if (requester.preferences?.assistant_enabled !== true) {
    return { ok: false, status: 403, motivo: 'assistente não habilitado' }
  }

  // Sem impersonação: escopo é o próprio usuário.
  if (!pedido.impersonateUserId || pedido.impersonateUserId === usuario.id) {
    return {
      ok: true,
      requesterId: usuario.id,
      scopeUserId: usuario.id,
      impersonando: false,
      currency: moedaDe(requester),
    }
  }

  // Impersonação: exclusiva de admin.
  if (requester.role !== 'admin') {
    return { ok: false, status: 403, motivo: 'impersonação negada: requer admin' }
  }

  // Claims do ADMIN para o RLS liberar a leitura do perfil alvo.
  const alvo = await deps.carregarPerfil(pedido.impersonateUserId, usuario.id)
  if (!alvo) return { ok: false, status: 403, motivo: 'usuário alvo não encontrado' }

  return {
    ok: true,
    requesterId: usuario.id,
    scopeUserId: pedido.impersonateUserId,
    impersonando: true,
    currency: moedaDe(alvo), // moeda do ESCOPO, não do admin
  }
}
