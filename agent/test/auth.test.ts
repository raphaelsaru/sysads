import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveScope, type AuthDeps, type Perfil } from '../src/auth.ts'

// Duplas de teste: nada de rede nos testes unitários.
const perfis: Record<string, Perfil> = {
  'admin-1': { role: 'admin', preferences: { assistant_enabled: true, currency: 'USD' } },
  'user-1': { role: 'user', preferences: { assistant_enabled: true } },
  'user-2': { role: 'user', preferences: { assistant_enabled: true } },
  'user-off': { role: 'user', preferences: {} },
}

const deps: AuthDeps = {
  verificarToken: async (token: string) =>
    token.startsWith('valido:') ? { id: token.slice(7) } : null,
  carregarPerfil: async (id: string) => perfis[id] ?? null,
}

test('token inválido é rejeitado', async () => {
  const r = await resolveScope({ token: 'lixo' }, deps)
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.status, 401)
})

test('usuário comum recebe o próprio escopo', async () => {
  const r = await resolveScope({ token: 'valido:user-1' }, deps)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.requesterId, 'user-1')
  assert.equal(r.scopeUserId, 'user-1')
  assert.equal(r.impersonando, false)
  assert.equal(r.currency, 'BRL')
})

test('usuário sem a flag é bloqueado', async () => {
  const r = await resolveScope({ token: 'valido:user-off' }, deps)
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.status, 403)
})

test('usuário comum NÃO consegue impersonar', async () => {
  const r = await resolveScope(
    { token: 'valido:user-1', impersonateUserId: 'user-2' },
    deps,
  )
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.status, 403)
  assert.match(r.motivo, /impersona/i)
})

test('admin consegue impersonar', async () => {
  const r = await resolveScope(
    { token: 'valido:admin-1', impersonateUserId: 'user-2' },
    deps,
  )
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.requesterId, 'admin-1')
  assert.equal(r.scopeUserId, 'user-2')
  assert.equal(r.impersonando, true)
})

test('admin sem impersonar vê só os próprios dados', async () => {
  const r = await resolveScope({ token: 'valido:admin-1' }, deps)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.scopeUserId, 'admin-1')
  assert.equal(r.impersonando, false)
})

test('impersonar alvo inexistente falha', async () => {
  const r = await resolveScope(
    { token: 'valido:admin-1', impersonateUserId: 'fantasma' },
    deps,
  )
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.status, 403)
})

test('moeda vem do perfil do escopo, não do requester', async () => {
  const r = await resolveScope(
    { token: 'valido:admin-1', impersonateUserId: 'user-2' },
    deps,
  )
  assert.equal(r.ok, true)
  // admin-1 tem USD; user-2 não tem currency => BRL
  assert.equal(r.ok === true && r.currency, 'BRL')
})

test('moeda válida do perfil é preservada', async () => {
  // Sem isto, um moedaDe() que sempre devolvesse 'BRL' passaria em todos os outros testes.
  const r = await resolveScope({ token: 'valido:admin-1' }, deps)
  assert.equal(r.ok === true && r.currency, 'USD')

  const d: AuthDeps = {
    verificarToken: deps.verificarToken,
    carregarPerfil: async () => ({
      role: 'user',
      preferences: { assistant_enabled: true, currency: 'EUR' },
    }),
  }
  const r2 = await resolveScope({ token: 'valido:qualquer' }, d)
  assert.equal(r2.ok === true && r2.currency, 'EUR')
})

test('admin impersonando usuário USD vê USD', async () => {
  const d: AuthDeps = {
    verificarToken: deps.verificarToken,
    carregarPerfil: async (id) =>
      id === 'admin-brl'
        ? { role: 'admin', preferences: { assistant_enabled: true, currency: 'BRL' } }
        : { role: 'user', preferences: { assistant_enabled: true, currency: 'USD' } },
  }
  const r = await resolveScope(
    { token: 'valido:admin-brl', impersonateUserId: 'user-usd' },
    d,
  )
  assert.equal(r.ok === true && r.currency, 'USD')
})

test('carregarPerfil recebe o id do admin ao carregar o alvo', async () => {
  const chamadas: Array<[string, string | undefined]> = []
  const espiao: AuthDeps = {
    verificarToken: deps.verificarToken,
    carregarPerfil: async (id, comoUsuario) => {
      chamadas.push([id, comoUsuario])
      return perfis[id] ?? null
    },
  }
  const r = await resolveScope(
    { token: 'valido:admin-1', impersonateUserId: 'user-2' },
    espiao,
  )
  assert.equal(r.ok, true)
  assert.deepEqual(chamadas, [
    ['admin-1', undefined],
    ['user-2', 'admin-1'],
  ])
})

test('impersonar a si mesmo não conta como impersonação', async () => {
  const r = await resolveScope(
    { token: 'valido:user-1', impersonateUserId: 'user-1' },
    deps,
  )
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.scopeUserId, 'user-1')
  assert.equal(r.impersonando, false)
})

test('moeda inválida no perfil cai pra BRL', async () => {
  const estranhos: Record<string, Perfil> = {
    'a': { role: 'user', preferences: { assistant_enabled: true, currency: 'BITCOIN' } },
    'b': { role: 'user', preferences: { assistant_enabled: true, currency: 42 } },
    'c': { role: 'user', preferences: { assistant_enabled: true, currency: null } },
  }
  const d: AuthDeps = {
    verificarToken: deps.verificarToken,
    carregarPerfil: async (id) => estranhos[id] ?? null,
  }
  for (const id of ['a', 'b', 'c']) {
    const r = await resolveScope({ token: `valido:${id}` }, d)
    assert.equal(r.ok === true && r.currency, 'BRL', `perfil ${id}`)
  }
})

test('flag não-booleana não habilita', async () => {
  const falsos: Record<string, Perfil> = {
    's': { role: 'user', preferences: { assistant_enabled: 'true' } },
    'n': { role: 'user', preferences: { assistant_enabled: 1 } },
    'a': { role: 'admin', preferences: { assistant_enabled: 'true' } },
  }
  const d: AuthDeps = {
    verificarToken: deps.verificarToken,
    carregarPerfil: async (id) => falsos[id] ?? null,
  }
  for (const id of ['s', 'n', 'a']) {
    const r = await resolveScope({ token: `valido:${id}` }, d)
    assert.equal(r.ok, false, `perfil ${id} não deveria passar`)
    assert.equal(r.ok === false && r.status, 403)
  }
})

test('admin sem a flag não consegue impersonar', async () => {
  const d: AuthDeps = {
    verificarToken: deps.verificarToken,
    carregarPerfil: async (id) =>
      id === 'admin-off'
        ? { role: 'admin', preferences: {} }
        : (perfis[id] ?? null),
  }
  const r = await resolveScope(
    { token: 'valido:admin-off', impersonateUserId: 'user-2' },
    d,
  )
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.status, 403)
})

test('perfil do requester ausente é 401', async () => {
  const r = await resolveScope({ token: 'valido:ninguem' }, deps)
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.status, 401)
})

test('alvo sem a flag ainda pode ser impersonado pelo admin', async () => {
  const r = await resolveScope(
    { token: 'valido:admin-1', impersonateUserId: 'user-off' },
    deps,
  )
  // A flag é do requester; o alvo é apenas dado.
  assert.equal(r.ok, true)
  assert.equal(r.ok === true && r.scopeUserId, 'user-off')
})
