# Perfis de acesso e navegação — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Perfis gestor/vendedor/artista + dono multi-empresa, com menus, rotas, APIs e RLS restritos por perfil e home orientada a cliente.

**Architecture:** Matriz única `src/lib/permissions.ts` (`pode`, `homePath`, `areaDaRota`) usada por Sidebar, middleware e APIs. No banco: `ve_empresa_toda()` p/ leitura da empresa (admin/owner/gestor), escrita segue `is_tenant_owner()` (admin/owner). Dono multi-empresa via `tenant_owners` + `active_tenant_id`.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS, MCP `execute_sql`/`apply_migration`, project `bjtjyzdbewxoypjaphqs`), Vitest.

Design: `docs/plans/2026-10-01-perfis-acesso-design.md`.

Convenções: commits curtos em pt sem acento; terminar com as linhas de co-autoria da sessão. Rodar `pnpm test`, `pnpm lint`, `pnpm build` no fim de cada bloco de UI.

**Desvio do design (simplificação):** em vez de `/conta/conexoes`, `/settings/integrations` fica acessível a todos (cards pessoais WhatsApp/Instagram); o item de menu "Integrações" só aparece p/ owner/gestor/admin, e vendedor/artista chegam via "Minhas conexões" no menu da conta. Card Meta gated por `pode(role,'meta')`.

---

### Task 1: Tipos + matriz de permissões (TDD)

**Files:**
- Modify: `src/types/crm.ts:6`
- Create: `src/lib/permissions.ts`
- Test: `src/lib/permissions.test.ts`
- Modify: `src/lib/roles.ts`

**Step 1: Ampliar `UserRole`**

```ts
// 'admin' = superadmin da plataforma (nome mantido no enum do banco). 'user' = Artista.
export type UserRole = 'admin' | 'owner' | 'gestor' | 'vendedor' | 'user'
```

**Step 2: Teste falhando** — `src/lib/permissions.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { areaDaRota, homePath, pode } from './permissions'
import type { UserRole } from '@/types/crm'

const ROLES: UserRole[] = ['admin', 'owner', 'gestor', 'vendedor', 'user']

describe('pode', () => {
  it('todos veem leads, clientes e agenda', () => {
    for (const r of ROLES) for (const a of ['leads', 'clientes', 'agenda'] as const) expect(pode(r, a)).toBe(true)
  })
  it('painel: todos menos vendedor', () => {
    expect(ROLES.filter(r => pode(r, 'painel'))).toEqual(['admin', 'owner', 'gestor', 'user'])
  })
  it('integracoes: admin, owner, gestor', () => {
    expect(ROLES.filter(r => pode(r, 'integracoes'))).toEqual(['admin', 'owner', 'gestor'])
  })
  it('meta: so admin e gestor', () => {
    expect(ROLES.filter(r => pode(r, 'meta'))).toEqual(['admin', 'gestor'])
  })
  it('empresa e equipe: admin e owner', () => {
    expect(ROLES.filter(r => pode(r, 'empresa'))).toEqual(['admin', 'owner'])
    expect(ROLES.filter(r => pode(r, 'equipe'))).toEqual(['admin', 'owner'])
  })
  it('ver_empresa e visualizar_como: admin, owner, gestor', () => {
    expect(ROLES.filter(r => pode(r, 'ver_empresa'))).toEqual(['admin', 'owner', 'gestor'])
    expect(ROLES.filter(r => pode(r, 'visualizar_como'))).toEqual(['admin', 'owner', 'gestor'])
  })
  it('editar_empresa: admin e owner', () => {
    expect(ROLES.filter(r => pode(r, 'editar_empresa'))).toEqual(['admin', 'owner'])
  })
  it('admin global: so admin', () => {
    expect(ROLES.filter(r => pode(r, 'admin'))).toEqual(['admin'])
  })
  it('sem role: nada', () => {
    expect(pode(null, 'leads')).toBe(false)
    expect(pode(undefined, 'leads')).toBe(false)
  })
})

describe('homePath', () => {
  it('por perfil', () => {
    expect(homePath('admin')).toBe('/admin/empresas')
    expect(homePath('owner')).toBe('/clientes')
    expect(homePath('gestor')).toBe('/leads')
    expect(homePath('vendedor')).toBe('/leads')
    expect(homePath('user')).toBe('/clientes')
  })
  it('home sempre permitida (evita loop de redirect)', () => {
    for (const r of ROLES) {
      const area = areaDaRota(homePath(r))
      expect(area && pode(r, area)).toBe(true)
    }
  })
})

describe('areaDaRota', () => {
  it('mapeia prefixos', () => {
    expect(areaDaRota('/admin')).toBe('admin')
    expect(areaDaRota('/admin/empresas/x')).toBe('admin')
    expect(areaDaRota('/settings/users')).toBe('admin')
    expect(areaDaRota('/empresa')).toBe('empresa')
    expect(areaDaRota('/empresas')).toBeNull()
    expect(areaDaRota('/dashboard')).toBe('painel')
    expect(areaDaRota('/leads/123')).toBe('leads')
    expect(areaDaRota('/clientes')).toBe('clientes')
    expect(areaDaRota('/calendario')).toBe('agenda')
    expect(areaDaRota('/settings/integrations')).toBeNull()
  })
})
```

**Step 3:** `pnpm test src/lib/permissions.test.ts` → FAIL (módulo não existe).

**Step 4: Implementar** — `src/lib/permissions.ts`

```ts
import type { UserRole } from '@/types/crm'

// Matriz de acesso por perfil. Fonte única p/ Sidebar, middleware e APIs.
// Design: docs/plans/2026-10-01-perfis-acesso-design.md
export type Area =
  | 'leads' | 'clientes' | 'agenda' | 'painel'
  | 'integracoes'      // menu Integrações (empresa)
  | 'meta'             // card/API Meta CAPI
  | 'empresa'          // /empresa (cor, equipe)
  | 'equipe'           // convidar/gerenciar usuários
  | 'ver_empresa'      // lê dados de toda a empresa
  | 'editar_empresa'   // edita/exclui dados de outros usuários
  | 'visualizar_como'
  | 'admin'            // painel global superadmin

const BASE: readonly Area[] = ['leads', 'clientes', 'agenda']

const MATRIZ: Record<UserRole, readonly Area[]> = {
  admin: [...BASE, 'painel', 'integracoes', 'meta', 'empresa', 'equipe', 'ver_empresa', 'editar_empresa', 'visualizar_como', 'admin'],
  owner: [...BASE, 'painel', 'integracoes', 'empresa', 'equipe', 'ver_empresa', 'editar_empresa', 'visualizar_como'],
  gestor: [...BASE, 'painel', 'integracoes', 'meta', 'ver_empresa', 'visualizar_como'],
  vendedor: BASE,
  user: [...BASE, 'painel'],
}

export function pode(role: UserRole | null | undefined, area: Area): boolean {
  return !!role && MATRIZ[role].includes(area)
}

const HOME: Record<UserRole, string> = {
  admin: '/admin/empresas',
  owner: '/clientes',
  gestor: '/leads',
  vendedor: '/leads',
  user: '/clientes',
}

export function homePath(role: UserRole | null | undefined): string {
  return role ? HOME[role] : '/leads'
}

// Prefixo de rota → área exigida. Rotas fora da lista não são restritas por perfil.
const ROTAS: [string, Area][] = [
  ['/admin', 'admin'],
  ['/settings/users', 'admin'],
  ['/empresa', 'empresa'],
  ['/dashboard', 'painel'],
  ['/leads', 'leads'],
  ['/clientes', 'clientes'],
  ['/calendario', 'agenda'],
]

export function areaDaRota(pathname: string): Area | null {
  const achada = ROTAS.find(([base]) => pathname === base || pathname.startsWith(base + '/'))
  return achada ? achada[1] : null
}
```

**Step 5:** `pnpm test src/lib/permissions.test.ts` → PASS.

**Step 6: Atualizar `src/lib/roles.ts`** (labels + helpers delegam à matriz):

```ts
import type { UserRole } from '@/types/crm'
import { pode } from '@/lib/permissions'

export const isSuperadmin = (role?: UserRole | null) => role === 'admin'
export const canManageTeam = (role?: UserRole | null) => pode(role, 'equipe')

export const roleLabel: Record<UserRole, string> = {
  admin: 'Superadmin',
  owner: 'Dono',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  user: 'Artista',
}

// Papéis que o dono pode atribuir na própria empresa.
export const ROLES_CONVIDAVEIS = ['gestor', 'vendedor', 'user'] as const
export type RoleConvidavel = typeof ROLES_CONVIDAVEIS[number]
export const isRoleConvidavel = (r: unknown): r is RoleConvidavel =>
  typeof r === 'string' && (ROLES_CONVIDAVEIS as readonly string[]).includes(r)
```

**Step 7:** `pnpm test && npx tsc --noEmit` → PASS (corrigir qualquer `Record<UserRole,…>` faltando chaves que o tsc apontar, ex. badge do Sidebar usa ternário — ok).

**Step 8: Commit** `feat: matriz de permissoes por perfil`

---

### Task 2: Migration — novos valores do enum

`ALTER TYPE ... ADD VALUE` não pode ser usado na mesma transação → migration própria.

**Files:** Create `supabase/migrations/20261001160000_roles_gestor_vendedor.sql`

```sql
-- Novos perfis. 'user' passa a ser exibido como Artista (só label no app).
alter type public.user_role add value if not exists 'gestor';
alter type public.user_role add value if not exists 'vendedor';
```

**Steps:** aplicar via MCP `apply_migration` (name `roles_gestor_vendedor`); conferir `select unnest(enum_range(null::user_role))` → 5 valores. Commit `feat(db): roles gestor e vendedor`.

---

### Task 3: Migration — tenant_owners, effective_tenant_id, ve_empresa_toda, policies

**Files:** Create `supabase/migrations/20261001161000_perfis_acesso.sql`

```sql
-- Dono de múltiplas empresas: vínculos extras (empresa primária continua em user_profiles.tenant_id).
-- Vínculos extras não ocupam slot (validar_slots conta só tenant_id).
create table if not exists public.tenant_owners (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_owners_user_idx on public.tenant_owners (user_id);
alter table public.tenant_owners enable row level security;

drop policy if exists tenant_owners_select on public.tenant_owners;
create policy tenant_owners_select on public.tenant_owners for select
  using (user_id = (select auth.uid()) or (select public.is_superadmin()));
-- escrita: só service role (rotas superadmin)

-- Empresa efetiva: superadmin visita qualquer uma; owner visita as vinculadas.
create or replace function public.effective_tenant_id(p_user_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select case
    when up.role = 'admin' then coalesce(up.active_tenant_id, up.tenant_id)
    else (
      select t.id from tenants t
       where t.is_active
         and t.id = case
           when up.role = 'owner' and up.active_tenant_id is not null
                and exists (select 1 from tenant_owners o
                             where o.user_id = up.id and o.tenant_id = up.active_tenant_id)
             then up.active_tenant_id
           else up.tenant_id
         end
    )
  end
  from user_profiles up
  where up.id = p_user_id and up.is_active;
$$;

-- Leitura de toda a empresa: superadmin, dono, gestor.
create or replace function public.ve_empresa_toda()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from user_profiles
     where id = auth.uid() and role in ('admin', 'owner', 'gestor') and is_active
  ) and public.current_tenant_id() is not null;
$$;

-- SELECT passa a usar ve_empresa_toda; INSERT/UPDATE/DELETE seguem is_tenant_owner (gestor só os próprios).
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select using (
  tenant_id = (select public.current_tenant_id())
  and (user_id = (select auth.uid()) or (select public.ve_empresa_toda()))
);

drop policy if exists negociacoes_select on public.negociacoes;
create policy negociacoes_select on public.negociacoes for select using (
  exists (select 1 from clientes c
           where c.id = negociacoes.cliente_id
             and c.tenant_id = (select public.current_tenant_id())
             and (c.user_id = (select auth.uid()) or (select public.ve_empresa_toda())))
);

drop policy if exists follow_ups_select on public.follow_ups;
create policy follow_ups_select on public.follow_ups for select using (
  exists (select 1 from clientes c
           where c.id = follow_ups.cliente_id
             and c.tenant_id = (select public.current_tenant_id())
             and (c.user_id = (select auth.uid()) or (select public.ve_empresa_toda())))
);

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles for select using (
  id = (select auth.uid())
  or (select public.is_superadmin())
  or (tenant_id = (select public.current_tenant_id()) and (select public.ve_empresa_toda()))
);

-- Dono em empresa vinculada: lead dele (user_id = dono) é válido nessa empresa.
drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update
  using (
    tenant_id = (select public.current_tenant_id())
    and (user_id = (select auth.uid()) or (select public.is_tenant_owner()))
  )
  with check (
    tenant_id = (select public.current_tenant_id())
    and exists (
      select 1 from user_profiles up
       where up.id = clientes.user_id
         and (up.tenant_id = clientes.tenant_id
              or up.role = 'admin'
              or exists (select 1 from tenant_owners o
                          where o.user_id = up.id and o.tenant_id = clientes.tenant_id))
    )
  );
```

**Steps:**
1. Antes: `select tablename, policyname, cmd from pg_policies where tablename in ('clientes','negociacoes','follow_ups','user_profiles')` e conferir nomes iguais aos dropados (migrations divergem do banco!).
2. Aplicar via `apply_migration` (name `perfis_acesso`).
3. `get_advisors` (security) → sem novos alertas em `tenant_owners`.
4. Commit `feat(db): tenant_owners e leitura por gestor`.

---

### Task 4: Testes SQL de isolamento

**Files:** Modify `supabase/tests/multitenant_rls.sql` (antes do `rollback` final; seguir o mesmo padrão de fixtures/`set_config`).

Fixtures novas (dentro do mesmo `begin`):
- `aaaaaaaa-0000-0000-0000-00000000000c` gestor A, `...0d` vendedor A (empresa A; subir `max_users` de A p/ 4).
- Lead do vendedor A: `'lead vendedor A'`.
- `insert into tenant_owners values ('bbbbbbbb-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000000a')` (owner A também dono de B).

Asserções (`do $$ … $$`):
```sql
-- gestor A: vê os 3 leads de A, perfis da empresa, mas não edita lead alheio
perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000c","role":"authenticated"}', true);
execute 'set local role authenticated';
select count(*) into n from clientes; if n <> 3 then raise exception 'FALHA gestor viu %', n; end if;
update clientes set nome = 'x' where nome = 'lead user A';
get diagnostics n = row_count; if n <> 0 then raise exception 'FALHA gestor editou lead alheio'; end if;
begin
  insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem)
  values ('aaaaaaaa-0000-0000-0000-00000000000d', current_date, 'gestor p/ outro', '11911110099', 'Outro');
  raise exception 'FALHA gestor criou lead p/ outro';
exception when insufficient_privilege then null; -- RLS
end;
execute 'reset role';

-- vendedor A: só o próprio
perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000d","role":"authenticated"}', true);
execute 'set local role authenticated';
select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA vendedor viu %', n; end if;
execute 'reset role';

-- owner A visitando B (vínculo): vê só B
update user_profiles set active_tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
execute 'set local role authenticated';
select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA owner A em B viu %', n; end if;
execute 'reset role';

-- sem vínculo: active_tenant_id ignorado (vendedor tentando visitar B)
update user_profiles set active_tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000' where id = 'aaaaaaaa-0000-0000-0000-00000000000d';
if public.effective_tenant_id('aaaaaaaa-0000-0000-0000-00000000000d') <> 'aaaaaaaa-1111-0000-0000-000000000000'
  then raise exception 'FALHA vendedor escapou p/ B'; end if;
-- vínculo não ocupa slot: B (1 slot) continua aceitando owner A vinculado (já inserido acima sem erro)
```
(Ajustar contagens existentes do owner A, que passam a ver 3 leads/4 perfis em A.)

**Steps:** rodar o arquivo via MCP `execute_sql` (o arquivo termina em `rollback`) → sem exceção. Commit `test(db): isolamento gestor, vendedor e dono multi-empresa`.

---

### Task 5: Middleware — guarda por área + redirect da home

**Files:** Modify `middleware.ts:126-136`

Substituir os dois `if` de `/admin` e `/empresa` por:

```ts
    const role = profile?.role as UserRole | undefined

    if (pathname === '/') {
      return redirectTo(homePath(role))
    }

    const area = areaDaRota(pathname)
    if (area && !pode(role, area)) {
      return redirectTo(homePath(role))
    }
```
Imports no topo: `import { areaDaRota, homePath, pode } from '@/lib/permissions'` e `import type { UserRole } from '@/types/crm'` (alias `@/` funciona no middleware da raiz? conferir `tsconfig` paths; se não, usar `./src/lib/permissions`).

**Steps:** `npx tsc --noEmit`; commit `feat: middleware restringe rotas por perfil`.

---

### Task 6: Leads em /leads + links

**Files:**
- Move: `src/app/page.tsx` → `src/app/leads/page.tsx` (`git mv`)
- Create: `src/app/page.tsx`
- Modify: `src/components/NotificationsBell.tsx:34`, `src/app/leads/[id]/page.tsx:319`, `src/components/auth/AuthGuard.tsx:108,133`, `src/app/auth/callback/page.tsx:84`

**Step 1:** `git mv src/app/page.tsx src/app/leads/page.tsx`. Nele, `mostrarColunaUsuario = pode(userProfile?.role, 'ver_empresa') && !impersonatedUserId` (trocar import de `canManageTeam` por `pode`).

**Step 2:** Novo `src/app/page.tsx` (fallback; middleware já redireciona):

```tsx
import { redirect } from 'next/navigation'
import { getCaller } from '@/lib/tenant-server'
import { homePath } from '@/lib/permissions'

export default async function Home() {
  const caller = await getCaller()
  redirect(caller ? homePath(caller.role) : '/auth/login')
}
```

**Step 3:** `NotificationsBell`: `router.push(\`/leads/${leadId}\`)`. `leads/[id]` botão voltar: `router.push('/leads')`. `AuthGuard`/`callback` mantêm `'/'` (redirect resolve).

**Step 4:** `pnpm build` → ok; `pnpm dev`, logar e checar `/` → home do perfil. Commit `feat: leads em /leads e home por perfil`.

---

### Task 7: Sidebar por matriz + Minhas conexões

**Files:** Modify `src/components/layout/Sidebar.tsx`

**Step 1:** Em `NavLinks`:

```ts
  // Superadmin visitando outra empresa navega como owner (regra existente).
  const visitandoOutraEmpresa = isSuperadmin(userProfile?.role) && !!tenant && !!userProfile?.tenant_id && tenant.id !== userProfile.tenant_id
  const role = visitandoOutraEmpresa ? 'owner' : userProfile?.role

  const navItems = ([
    { href: '/clientes', label: 'Clientes', area: 'clientes' },
    { href: '/leads', label: 'Leads', area: 'leads' },
    { href: '/dashboard', label: 'Painel', area: 'painel' },
    { href: '/calendario', label: 'Agenda', area: 'agenda' },
    { href: '/settings/integrations', label: 'Integrações', area: 'integracoes' },
    { href: '/empresa', label: 'Minha empresa', area: 'empresa' },
    { href: '/admin/empresas', label: 'Empresas', area: 'admin' },
    { href: '/admin', label: 'Administração', area: 'admin' },
    { href: '/settings/users', label: 'Usuários (global)', area: 'admin' },
    { href: '/admin/google-calendar', label: 'Google Calendar', area: 'admin' },
  ] as const).filter(i => pode(role, i.area))
```
Ativo: `pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'))`.

**Step 2:** `podeVisualizarComo = pode(userProfile?.role, 'visualizar_como')`.

**Step 3:** `AccountFooter` — antes de "Sair", se `!pode(userProfile?.role, 'integracoes')`:
```tsx
<DropdownMenuItem asChild><Link href="/settings/integrations">Minhas conexões</Link></DropdownMenuItem>
```

**Step 4:** Badge do role: `variant={role === 'admin' ? 'default' : role === 'owner' ? 'outline' : 'secondary'}` (já cobre novos). Remover import de `canManageTeam`.

**Step 5:** Visualizar como p/ gestor: `src/hooks/useAssistant.ts:65` e `AssistantPanel.tsx:111` usam `isSuperadmin` p/ impersonação do assistente — manter (assistente é só superadmin).

**Step 6:** `pnpm lint && pnpm build`. Commit `feat: sidebar filtrada por perfil`.

---

### Task 8: Integrações — Meta p/ gestor, cards pessoais p/ todos

**Files:**
- Modify: `src/app/settings/integrations/page.tsx`
- Modify: `src/app/empresa/page.tsx:441` (remover `MetaAdsCard` e import)
- Modify: `src/app/api/empresa/meta/route.ts:13,63`, `meta/testar/route.ts:12`, `meta/reprocessar/route.ts:11`
- Modify: `src/app/api/empresa/usuarios/route.ts:12` (GET)

**Step 1:** APIs Meta: `!isSuperadmin(caller.role)` → `!pode(caller.role, 'meta')`.

**Step 2:** GET `/api/empresa/usuarios`: `!pode(caller.role, 'ver_empresa')` (POST continua `canManageTeam`).

**Step 3:** Página de integrações: título "Integrações" se `pode(role,'integracoes')`, senão "Minhas conexões". Cards WhatsApp/Instagram sempre. Abaixo, se `pode(userProfile?.role, 'meta')`:
```tsx
const { userProfile, tenant } = useAuth()
const [usuarios, setUsuarios] = useState<{ id: string; full_name: string | null; email: string | null }[]>([])
useEffect(() => {
  if (!pode(userProfile?.role, 'meta') || !tenant?.id) return
  fetch('/api/empresa/usuarios?ativos=1').then(r => r.ok ? r.json() : { usuarios: [] })
    .then(d => setUsuarios(d.usuarios || [])).catch(() => {})
}, [userProfile?.role, tenant?.id])
…
{pode(userProfile?.role, 'meta') && <MetaAdsCard tenantId={tenant?.id ?? null} usuarios={usuarios} />}
```

**Step 4:** Atualizar `CLAUDE.md` seção Meta CAPI: "Card em `/settings/integrations`, gestor/superadmin".

**Step 5:** `pnpm build`; manual: gestor vê Meta; owner não; vendedor vê só cards pessoais. Commit `feat: meta capi liberado p/ gestor em integracoes`.

---

### Task 9: Gestor só leitura em lead alheio

**Files:** Modify `src/app/leads/[id]/page.tsx`, `src/components/ClienteTable.tsx`

**Step 1:** Em `leads/[id]`: `const somenteLeitura = !!cliente?.userId && cliente.userId !== user?.id && !pode(userProfile?.role, 'editar_empresa')`. Localizar (grep `onSubmit|Salvar|Excluir|excluir`) botões de salvar/excluir/nova negociação/follow-up e esconder/desabilitar quando `somenteLeitura`; mostrar `<Badge variant="secondary">Somente leitura</Badge>` no header.

**Step 2:** `ClienteTable`: aceitar prop `podeExcluir?: (c: Cliente) => boolean`; no `/leads` passar `c => c.userId === user?.id || pode(role,'editar_empresa')`.

**Step 3:** `pnpm build`; manual com gestor. Commit `feat: gestor ve leads alheios somente leitura`.

---

### Task 10: /clientes em cards

**Files:**
- Create: `src/components/cliente/ClienteCard.tsx`
- Modify: `src/app/clientes/page.tsx` (substituir `ClienteTable` pelo grid)

**Step 1:** `ClienteCard.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import type { Cliente } from '@/types/crm'

type Moeda = 'BRL' | 'USD' | 'EUR'

function statusPagamento(c: Cliente): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  const n = c.ultimaNegociacao
  if (n?.vendaPaga) return { label: 'Pago', variant: 'default' }
  if (n?.pagouSinal) return { label: 'Sinal pago', variant: 'secondary' }
  return { label: 'A receber', variant: 'outline' }
}

export default function ClienteCard({ cliente, currency, responsavel }: {
  cliente: Cliente
  currency: Moeda
  responsavel?: string
}) {
  const status = statusPagamento(cliente)
  const ultima = cliente.ultimaNegociacao
  return (
    <Link href={`/leads/${cliente.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{cliente.nome}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">{cliente.whatsappInstagram}</p>
          </div>
          <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="text-lg font-semibold">{formatCurrency(cliente.ltv ?? 0, currency)}</div>
          <div className="text-xs text-muted-foreground">
            {ultima?.dataContato ? `Última negociação: ${new Date(ultima.dataContato + 'T00:00').toLocaleDateString('pt-BR')}` : 'Sem negociação'}
            {cliente.totalFollowUps ? ` · ${cliente.totalFollowUps} follow-ups` : ''}
          </div>
          {responsavel && <div className="text-xs text-muted-foreground">Responsável: {responsavel}</div>}
        </CardContent>
      </Card>
    </Link>
  )
}
```
(Conferir assinatura real de `formatCurrency` e formato de `dataContato` antes; ajustar.)

**Step 2:** Em `clientes/page.tsx` trocar o bloco `<ClienteTable …/>` por:
```tsx
<div className="space-y-4">
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {clientes.map(c => (
      <ClienteCard key={c.id} cliente={c} currency={currency} responsavel={mostrarResponsavel ? nomesPorUsuario[c.userId ?? ''] : undefined} />
    ))}
  </div>
  {hasMore && (
    <div className="flex justify-center">
      <Button variant="outline" onClick={carregarMaisClientes} disabled={loadingMais}>
        {loadingMais ? 'Carregando…' : 'Carregar mais'}
      </Button>
    </div>
  )}
</div>
```
`mostrarResponsavel = pode(role,'ver_empresa') && !impersonatedUserId`; `nomesPorUsuario` carregado como em `src/app/leads/page.tsx` (copiar o `useEffect` que monta o mapa via `/api/empresa/usuarios?ativos=1`; se for igual, extrair hook `useNomesUsuarios` em `src/hooks/useNomesUsuarios.ts` e usar nos dois). Remover `excluirCliente`/`handleEditarCliente` não usados. Título: owner → "Clientes da empresa", artista → "Meus clientes".

**Step 3:** `pnpm lint && pnpm build`; manual: owner cai em `/clientes`, cards abrem detalhe. Commit `feat: clientes em cards c/ resumo`.

---

### Task 11: Convite com papel + troca de papel

**Files:**
- Modify: `src/app/api/empresa/usuarios/route.ts` (POST)
- Modify: `src/app/api/empresa/usuarios/[id]/route.ts` (PATCH)
- Modify: `src/app/empresa/page.tsx` (form convite + coluna papel)

**Step 1:** POST: `const role = body?.role ?? 'user'; if (!isRoleConvidavel(role)) return 400 'Papel inválido'`; passar `role` p/ `convidarUsuario`.

**Step 2:** PATCH aceita `{ is_active?: boolean, role?: RoleConvidavel }` (pelo menos um). Validar `role` com `isRoleConvidavel`; alvo `owner`/`admin` não muda por aqui (403/404 como hoje). Update com os campos presentes. A trava "não pode desativar a si mesmo" só quando `is_active` presente; trocar o próprio papel → 400.

**Step 3:** Página `/empresa`: estado `convite.role` (default `'user'`), `<Select>` com `ROLES_CONVIDAVEIS.map(r => <SelectItem value={r}>{roleLabel[r]}</SelectItem>)`, enviar no body. Na tabela, coluna Papel vira `<Select>` p/ usuários não owner/admin (`PATCH { role }`, recarrega lista em erro).

**Step 4:** `pnpm build`; manual: convidar gestor, trocar artista→vendedor. Commit `feat: owner escolhe papel no convite`.

---

### Task 12: Dono multi-empresa — vínculo (superadmin) + switcher (owner)

**Files:**
- Create: `src/app/api/admin/empresas/[id]/donos/route.ts`
- Create: `src/app/api/empresa/minhas/route.ts`
- Modify: `src/app/api/admin/empresa-ativa/route.ts`
- Modify: `src/components/layout/EmpresaSwitcher.tsx`
- Modify: `src/app/admin/empresas/[id]/page.tsx`

**Step 1:** `donos/route.ts`:
- `GET` → `tenant_owners` da empresa + `full_name` (admin client) e email (`auth.admin.getUserById`).
- `POST { email }` → `buscarUsuarioPorEmail`; perfil precisa `role='owner'`, `is_active`, `tenant_id <> id`; insert em `tenant_owners` (conflito → 409 "Já vinculado").
- `DELETE ?user_id=` → apaga vínculo e `update user_profiles set active_tenant_id = null where id = user_id and active_tenant_id = id`.
- Todas: `getCaller()` + `isSuperadmin` senão 403; `isUuid` nos ids.

**Step 2:** `GET /api/empresa/minhas` (owner): `[primária, ...vinculadas]` com `{ id, name, is_active }` via admin client; outros roles → `{ empresas: [] }`.

**Step 3:** `empresa-ativa` POST: permitir `owner` quando `tenantId === null || tenantId === ownTenantId || existe tenant_owners(user, tenantId)`; senão 403. Superadmin inalterado. Atualizar comentário.

**Step 4:** `EmpresaSwitcher`: `const owner = userProfile?.role === 'owner'`; carrega de `/api/admin/empresas` (superadmin) ou `/api/empresa/minhas` (owner, cache separado); owner só renderiza se `empresas.length > 1`; badge "Visitando" só p/ superadmin. Comentário do topo: "Seletor de empresa (superadmin ou dono com várias empresas)".

**Step 5:** `/admin/empresas/[id]`: card "Donos adicionais" — lista, input email + "Vincular", botão remover.

**Step 6:** `pnpm build`; manual: vincular owner A a B, owner A troca no switcher, vê dados de B, volta. Commit `feat: dono com multiplas empresas`.

---

### Task 13: Docs + verificação final

**Files:** `CLAUDE.md`, memória `multitenant-empresas.md`

**Step 1:** CLAUDE.md: roles (`admin|owner|gestor|vendedor|user=Artista`), `src/lib/permissions.ts`, `tenant_owners`, `ve_empresa_toda()`, `/leads`, `/` redireciona por perfil, middleware guarda por `areaDaRota`, card Meta em integrações.

**Step 2:** `pnpm test && pnpm lint && pnpm build` → tudo verde. Rodar `supabase/tests/multitenant_rls.sql` e `meta_outbox.sql` de novo.

**Step 3:** Manual por perfil (criar usuários de teste em empresa de teste): superadmin, owner, gestor, vendedor, artista — menus, home, rotas bloqueadas por URL direta, APIs (`/api/empresa/meta` 403 p/ owner).

**Step 4:** Commit `docs: perfis de acesso`.
