# Multitenant por Empresa — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Isolar dados por empresa (tenant) com hierarquia superadmin → owner → user, slots, ativação/desativação, convite por email, página "Minha empresa" com cor primária e painel superadmin.

**Architecture:** Isolamento no Postgres via RLS usando funções `security definer` (`current_tenant_id()`, `is_tenant_owner()`, `is_superadmin()`). Escritas privilegiadas (convite, ativar/desativar, trocar empresa, criar empresa) passam por rotas API que autorizam e usam service role. Front lê tenant/cor via `AuthContext`.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres/RLS/Auth admin API), shadcn/ui, Tailwind.

Design: `docs/plans/2026-09-30-multitenant-design.md`.

---

## Decisões técnicas (complementam o design)

- **Enum `user_role` mantém `admin` = superadmin.** Só adiciona `owner`. Todos os checks `role === 'admin'` existentes (Google Calendar, WAHA, assistente) continuam significando superadmin. Label na UI: "Superadmin".
- **Tenant Prizely canônico = `00000000-0000-0000-0000-000000000001`** (slug `prizely`, já é default das colunas e tem a maioria dos dados). Tudo de `8096819e-…` migra pra ele; `8096819e` vira "Prizely (antigo)", vazio. Demais tenants órfãos intocados.
- **Os 11 usuários atuais → Prizely**, ativos. `max_users` = 11.
- **Dedup de lead passa a ser por empresa** (`find_or_create_cliente` + índices únicos `(tenant_id, telefone_normalizado)` / `(tenant_id, instagram_normalizado)`).
- **`find_or_create_cliente`**: revoga `anon`/`PUBLIC` (hoje anon pode executar) e exige `p_user_id = auth.uid()` fora de service role.
- **Contexto confiável em triggers**: `current_user` dentro de `security definer` é o dono da função, nunca `service_role` — o check atual em `proteger_campos_privilegiados` não funciona. Nova função `is_trusted_context()` lê o `role` do JWT (`service_role`) ou ausência de JWT (conexão direta/migration).
- **`handle_new_user()` não muda** e não confia em metadata: convite cria o auth user, e a API grava `tenant_id`/`role`/`full_name` em `user_profiles` via service role logo em seguida. Signup do app financeiro continua gerando `user_profiles` com `tenant_id null` → sem acesso ao CRM.
- **Convite**: template "Invite user" usa `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite` (SiteURL do projeto pode ser do app financeiro). Página `/auth/definir-senha` chama `verifyOtp` + `updateUser({ password })`.
- **Middleware**: `'/'` em `publicPaths` com `startsWith` torna toda rota pública hoje. Corrigir.
- **`/settings/users`** continua superadmin-only (lista global + toggle assistente); remove criação com senha. Owner usa `/empresa`.
- **Painel superadmin, gestão de usuários de uma empresa**: botão "Gerenciar usuários" troca empresa ativa e abre `/empresa` (DRY, sem tela duplicada).
- **App financeiro desativado**: signup público desligado no Supabase; convite p/ email já existente sem empresa reaproveita a conta.
- **Assistente IA (VPS, service role)**: não respeita tenant. Auditoria adiada — só Prizely tem assistente liberado.
- **Promover usuário existente a dono de nova empresa**: leads antigos dele ficam na empresa de origem.
- Projeto sem framework de testes. Verificação = script SQL de RLS (Task 8) + `pnpm build` + checklist manual (Task 22).

Supabase project: `bjtjyzdbewxoypjaphqs`. Aplicar migrations com MCP `apply_migration` **e** salvar o mesmo SQL em `supabase/migrations/`. Antes de cada migration de policy, conferir `pg_policies` (migrations divergem do banco).

---

## Fase 1 — Banco

### Task 1: Backup

**Step 1:** Dump completo com a `DATABASE_URL` do `.env.local` (não imprimir o valor):
```bash
cd /Users/charbellelopes/prizely
set -a; source .env.local; set +a
pg_dump "$DATABASE_URL" --no-owner --no-privileges -n public -n auth -f supabase/backups/pre_multitenant_$(date +%Y%m%d_%H%M%S).sql
ls -la supabase/backups/
```
Expected: arquivo `.sql` com dezenas de MB. Se `pg_dump` reclamar de versão, usar `supabase db dump --db-url "$DATABASE_URL"`. Se falhar, parar e pedir ao usuário.

**Step 2:** Snapshot das policies atuais:
```sql
select tablename, policyname, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename in ('clientes','negociacoes','follow_ups','user_profiles','tenants');
```
Salvar saída em `supabase/backups/pg_policies_2026-09-30.json`. Não commitar backups (conferir `.gitignore`).

---

### Task 2: Migration — role `owner`

**Files:** Create `supabase/migrations/20260930100000_mt_role_owner.sql`

```sql
-- Isolada: ADD VALUE não pode ser usado na mesma transação em que é criado.
alter type public.user_role add value if not exists 'owner';
```

**Step 1:** `apply_migration` name `mt_role_owner`.
**Step 2:** Verificar: `select enum_range(null::public.user_role);` → `{admin,user,owner}`.
**Step 3:** Commit: `git add supabase/migrations/20260930100000_mt_role_owner.sql && git commit -m "feat(db): role owner"`

---

### Task 3: Migration — colunas + consolidação de dados

**Files:** Create `supabase/migrations/20260930100100_mt_dados.sql`

```sql
alter table public.user_profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists active_tenant_id uuid references public.tenants(id) on delete set null;

-- Consolida as duas "Prizely" no tenant canônico 0000...0001.
-- trigger de proteção ainda é o antigo (bloqueia tenant_id sem is_admin), desliga só nesta transação.
alter table public.user_profiles disable trigger trigger_proteger_campos_privilegiados;

update public.user_profiles
   set tenant_id = '00000000-0000-0000-0000-000000000001'
 where id in (select id from auth.users)
   and (tenant_id is null or tenant_id <> '00000000-0000-0000-0000-000000000001');

alter table public.user_profiles enable trigger trigger_proteger_campos_privilegiados;

update public.clientes    set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id <> '00000000-0000-0000-0000-000000000001';
update public.negociacoes set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id <> '00000000-0000-0000-0000-000000000001';
update public.follow_ups  set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id <> '00000000-0000-0000-0000-000000000001';

update public.tenants
   set name = 'Prizely (antigo)'
 where id = '8096819e-1349-4595-bfab-c998ad340ca7';

-- Prizely: slots = usuários atuais; sem cor custom (usa tema padrão).
update public.tenants
   set max_users = (select count(*) from public.user_profiles where tenant_id = '00000000-0000-0000-0000-000000000001'),
       is_active = true,
       branding = coalesce(branding, '{}'::jsonb) - 'primaryColor' - 'secondaryColor'
 where id = '00000000-0000-0000-0000-000000000001';

```

> Entre Task 3 e Task 7 leads novos (default 0001) continuam caindo no tenant certo. Aplicar Tasks 3–7 na mesma sessão, fora do horário de uso.

**Step 1:** Aplicar.
**Step 2:** Verificar:
```sql
select tenant_id, count(*) from user_profiles group by 1;          -- 1 linha: 0000..0001 → 11
select tenant_id, count(*) from clientes group by 1;               -- 1 linha: 0000..0001 → 4287
select name, max_users, branding from tenants where id='00000000-0000-0000-0000-000000000001';
```
**Step 3:** Commit `feat(db): consolida usuarios e dados no tenant Prizely`.

---

### Task 4: Migration — funções de tenant

**Files:** Create `supabase/migrations/20260930100200_mt_funcoes.sql`

```sql
-- Contexto confiável: service role (JWT role) ou conexão direta sem JWT (migration/psql).
create or replace function public.is_trusted_context()
returns boolean language sql stable set search_path = public as $$
  select case
    when nullif(current_setting('request.jwt.claims', true), '') is null then true
    else coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
  end;
$$;

-- Empresa efetiva de um usuário. Superadmin: empresa visitada (fallback própria).
-- Null se usuário inativo, ou empresa inativa (exceto superadmin).
create or replace function public.effective_tenant_id(p_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case when up.role = 'admin' then coalesce(up.active_tenant_id, up.tenant_id) else up.tenant_id end
    from user_profiles up
    left join tenants t on t.id = up.tenant_id
   where up.id = p_user_id
     and up.is_active
     and (up.role = 'admin' or t.is_active);
$$;

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select public.effective_tenant_id(auth.uid());
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- Owner ou superadmin (superadmin é dono de qualquer empresa que visita).
-- Usar sempre junto com tenant_id = current_tenant_id().
create or replace function public.is_tenant_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles
     where id = auth.uid() and role in ('admin', 'owner') and is_active
  ) and public.current_tenant_id() is not null;
$$;

-- Mantido por compatibilidade (get_all_users_admin, get_user_clientes_admin, policy de backup).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin();
$$;

-- Status de acesso ao CRM, lido pelo middleware.
create or replace function public.acesso_crm()
returns text language sql stable security definer set search_path = public as $$
  select case
    when up.id is null then 'sem_perfil'
    when not up.is_active then 'usuario_inativo'
    when up.role = 'admin' then 'ok'
    when up.tenant_id is null then 'sem_empresa'
    when not t.is_active then 'empresa_inativa'
    else 'ok'
  end
  from (select auth.uid() as uid) s
  left join user_profiles up on up.id = s.uid
  left join tenants t on t.id = up.tenant_id;
$$;

revoke execute on function public.effective_tenant_id(uuid), public.is_trusted_context() from public, anon, authenticated;
-- Funções usadas em policies ficam executáveis por anon (retornam null/false sem JWT).
grant execute on function public.current_tenant_id(), public.is_superadmin(), public.is_tenant_owner(), public.acesso_crm(), public.is_admin() to authenticated;
```

**Step 1:** Aplicar.
**Step 2:** Verificar como superadmin (id `32b521df-53ed-433e-97d2-0a18ccda1964`):
```sql
begin;
select set_config('request.jwt.claims', '{"sub":"32b521df-53ed-433e-97d2-0a18ccda1964","role":"authenticated"}', true);
set local role authenticated;
select public.current_tenant_id(), public.is_superadmin(), public.is_tenant_owner(), public.acesso_crm(), public.is_trusted_context();
rollback;
```
Expected: `0000…0001, true, true, ok, false`.
**Step 3:** Commit `feat(db): funcoes de tenant`.

---

### Task 5: Migration — triggers

**Files:** Create `supabase/migrations/20260930100300_mt_triggers.sql`

```sql
-- clientes: tenant do dono do lead (cobre webhooks service role e superadmin visitando).
create or replace function public.set_cliente_tenant_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.effective_tenant_id(coalesce(NEW.user_id, auth.uid()));
  end if;
  if NEW.tenant_id is null then
    raise exception 'usuario sem empresa ativa';
  end if;
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;
$$;

create or replace function public.auto_fill_user_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.effective_tenant_id(coalesce(NEW.user_id, auth.uid()));
  end if;
  if TG_OP = 'INSERT' and NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  if TG_OP = 'UPDATE' then
    NEW.updated_by := auth.uid();
  end if;
  return NEW;
end;
$$;

-- negociacoes/follow_ups: sempre herdam do cliente.
create or replace function public.set_tenant_from_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select c.tenant_id into NEW.tenant_id from clientes c where c.id = NEW.cliente_id;
  if NEW.tenant_id is null then
    raise exception 'cliente inexistente';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_set_negociacao_tenant on public.negociacoes;
create trigger trigger_set_negociacao_tenant before insert on public.negociacoes
  for each row execute function public.set_tenant_from_cliente();

drop trigger if exists trigger_set_followup_tenant on public.follow_ups;
create trigger trigger_set_followup_tenant before insert on public.follow_ups
  for each row execute function public.set_tenant_from_cliente();

-- Campos privilegiados de user_profiles.
create or replace function public.proteger_campos_privilegiados()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_trusted_context() or public.is_superadmin() then
    return NEW;
  end if;

  if NEW.role is distinct from OLD.role then
    raise exception 'alteracao de role nao permitida';
  end if;
  if NEW.tenant_id is distinct from OLD.tenant_id then
    raise exception 'alteracao de tenant_id nao permitida';
  end if;
  if NEW.is_active is distinct from OLD.is_active then
    raise exception 'alteracao de is_active nao permitida';
  end if;
  if NEW.active_tenant_id is distinct from OLD.active_tenant_id then
    raise exception 'alteracao de active_tenant_id nao permitida';
  end if;
  if coalesce(NEW.preferences ->> 'assistant_enabled', 'false')
     is distinct from coalesce(OLD.preferences ->> 'assistant_enabled', 'false') then
    raise exception 'alteracao de assistant_enabled nao permitida';
  end if;
  return NEW;
end;
$$;

-- Slots: usuários ativos por empresa (dono incluso). Vale inclusive p/ service role.
create or replace function public.validar_slots()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_ativos int;
begin
  if NEW.tenant_id is null or not NEW.is_active then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.tenant_id is not distinct from NEW.tenant_id and OLD.is_active then
    return NEW;
  end if;

  select max_users into v_max from tenants where id = NEW.tenant_id for update;
  select count(*) into v_ativos from user_profiles
   where tenant_id = NEW.tenant_id and is_active and id <> NEW.id;

  if v_max is not null and v_ativos >= v_max then
    raise exception 'limite de usuarios da empresa atingido' using errcode = 'P0001', hint = 'slots';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_validar_slots on public.user_profiles;
create trigger trigger_validar_slots before insert or update of tenant_id, is_active on public.user_profiles
  for each row execute function public.validar_slots();

-- tenants: max_users não pode ficar abaixo dos ativos.
create or replace function public.validar_max_users()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ativos int;
begin
  if NEW.max_users is distinct from OLD.max_users then
    select count(*) into v_ativos from user_profiles where tenant_id = NEW.id and is_active;
    if NEW.max_users < v_ativos then
      raise exception 'slots menor que usuarios ativos (%)', v_ativos using errcode = 'P0001', hint = 'slots';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_validar_max_users on public.tenants;
create trigger trigger_validar_max_users before update of max_users on public.tenants
  for each row execute function public.validar_max_users();

-- tenant_id passa a ser preenchido pelos triggers acima, não por default fixo.
alter table public.clientes    alter column tenant_id drop default;
alter table public.negociacoes alter column tenant_id drop default;
alter table public.follow_ups  alter column tenant_id drop default;
```

**Step 1:** Aplicar.
**Step 2:** Verificar insert via service role path (sem JWT = trusted):
```sql
begin;
insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem)
values ('32b521df-53ed-433e-97d2-0a18ccda1964', current_date, 'teste mt', '11999990000', 'Outro')
returning tenant_id;
rollback;
```
Expected: `00000000-0000-0000-0000-000000000001`.
**Step 3:** Commit `feat(db): triggers de tenant e slots`.

---

### Task 6: Migration — dedup por empresa

**Files:** Create `supabase/migrations/20260930100400_mt_dedup_por_tenant.sql`

```sql
drop index if exists public.clientes_telefone_normalizado_uidx;
drop index if exists public.clientes_instagram_normalizado_uidx;

create unique index clientes_tenant_telefone_normalizado_uidx
  on public.clientes (tenant_id, telefone_normalizado) where telefone_normalizado is not null;
create unique index clientes_tenant_instagram_normalizado_uidx
  on public.clientes (tenant_id, instagram_normalizado) where instagram_normalizado is not null;

create or replace function public.find_or_create_cliente(
  p_user_id uuid, p_data_contato date, p_nome text, p_identificador text, p_origem text, p_created_by uuid
)
returns table(id uuid, created boolean)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid;
  v_tenant uuid;
  v_tel text := public.normalizar_telefone(p_identificador);
  v_insta text := public.normalizar_instagram(p_identificador);
begin
  v_tenant := public.effective_tenant_id(p_user_id);
  if v_tenant is null then
    raise exception 'usuario sem empresa ativa';
  end if;

  -- Fora de service role: só p/ si mesmo, ou owner/superadmin p/ alguém da empresa atual.
  if not public.is_trusted_context() then
    if p_user_id is distinct from auth.uid()
       and not (public.is_tenant_owner() and v_tenant = public.current_tenant_id()) then
      raise exception 'p_user_id invalido';
    end if;
    p_created_by := auth.uid();
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant::text || ':' || coalesce(v_tel, v_insta, p_identificador), 0));

  select c.id into v_id from clientes c
   where c.tenant_id = v_tenant
     and ((v_tel is not null and c.telefone_normalizado = v_tel)
       or (v_insta is not null and c.instagram_normalizado = v_insta))
   order by c.created_at
   limit 1;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  begin
    insert into clientes (tenant_id, user_id, data_contato, nome, whatsapp_instagram, origem, created_by, updated_by)
    values (v_tenant, p_user_id, p_data_contato, p_nome, p_identificador, p_origem::origem_tipo, p_created_by, p_created_by)
    returning clientes.id into v_id;
  exception when unique_violation then
    select c.id into v_id from clientes c
     where c.tenant_id = v_tenant
       and ((v_tel is not null and c.telefone_normalizado = v_tel)
         or (v_insta is not null and c.instagram_normalizado = v_insta))
     order by c.created_at
     limit 1;
    return query select v_id, false;
    return;
  end;

  return query select v_id, true;
end;
$function$;

revoke execute on function public.find_or_create_cliente(uuid, date, text, text, text, uuid) from public, anon;
grant execute on function public.find_or_create_cliente(uuid, date, text, text, text, uuid) to authenticated, service_role;
```

**Step 1:** Aplicar.
**Step 2:** Verificar grants: `select grantee from information_schema.routine_privileges where routine_name='find_or_create_cliente';` → sem `anon`/`PUBLIC`.
**Step 3:** Atualizar comentário em `src/app/api/clientes/batch/route.ts:9` ("Dedup global" → "Dedup por empresa").
**Step 4:** Commit `feat(db): dedup de lead por empresa`.

---

### Task 7: Migration — RLS

**Files:** Create `supabase/migrations/20260930100500_mt_rls.sql`

Antes: rodar a query de `pg_policies` do Task 1 e confirmar que os nomes abaixo batem. Se aparecer policy extra, incluí-la no drop.

```sql
-- clientes
drop policy if exists "Users can view own clientes" on public.clientes;
drop policy if exists "Users can update own clientes" on public.clientes;
drop policy if exists "Users can delete own clientes" on public.clientes;
drop policy if exists "Users can create clientes" on public.clientes;

create policy clientes_select on public.clientes for select
  using (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())));
create policy clientes_insert on public.clientes for insert
  with check (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())));
create policy clientes_update on public.clientes for update
  using (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())))
  with check (tenant_id = (select public.current_tenant_id()));
create policy clientes_delete on public.clientes for delete
  using (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())));

-- negociacoes
drop policy if exists negociacoes_select on public.negociacoes;
drop policy if exists negociacoes_insert on public.negociacoes;
drop policy if exists negociacoes_update on public.negociacoes;
drop policy if exists negociacoes_delete on public.negociacoes;

create policy negociacoes_select on public.negociacoes for select using (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy negociacoes_insert on public.negociacoes for insert with check (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy negociacoes_update on public.negociacoes for update using (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy negociacoes_delete on public.negociacoes for delete using (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));

-- follow_ups
drop policy if exists "Users can view follow_ups" on public.follow_ups;
drop policy if exists "Users can create follow_ups" on public.follow_ups;
drop policy if exists "Users can delete follow_ups" on public.follow_ups;

create policy follow_ups_select on public.follow_ups for select using (exists (
  select 1 from clientes c where c.id = follow_ups.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy follow_ups_insert on public.follow_ups for insert with check (exists (
  select 1 from clientes c where c.id = follow_ups.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy follow_ups_delete on public.follow_ups for delete using (
  tenant_id = (select public.current_tenant_id()) and (created_by = (select auth.uid()) or (select public.is_tenant_owner())));

-- user_profiles
drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Admin full access to profiles" on public.user_profiles;

create policy user_profiles_select on public.user_profiles for select using (
  id = (select auth.uid())
  or (select public.is_superadmin())
  or (tenant_id = (select public.current_tenant_id()) and (select public.is_tenant_owner())));
create policy user_profiles_update_own on public.user_profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy user_profiles_superadmin on public.user_profiles for all
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));

-- tenants (escrita só via API/service role)
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select using (
  (select public.is_superadmin()) or id = (select public.current_tenant_id()));
```

**Step 1:** Aplicar.
**Step 2:** `get_advisors` (security) — sem novos erros.
**Step 3:** Commit `feat(db): rls por empresa`.

---

### Task 8: Teste SQL de isolamento

**Files:** Create `supabase/tests/multitenant_rls.sql`

Cria 2 empresas fictícias + 3 usuários em transação, verifica e faz rollback. Rodar via MCP `execute_sql` (se recusar `begin/rollback`, rodar com `psql "$DATABASE_URL" -f`).

```sql
begin;

-- fixtures (conexão direta = trusted, triggers deixam passar)
insert into auth.users (id, email, instance_id, aud, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'mt-owner-a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'mt-user-a@teste.local',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'mt-owner-b@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into tenants (id, name, slug, max_users, is_active) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'MT A', 'mt-a-teste', 2, true),
  ('bbbbbbbb-1111-0000-0000-000000000000', 'MT B', 'mt-b-teste', 1, true);

-- handle_new_user já criou user_profiles; ajusta
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'owner' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'user'  where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
update user_profiles set tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000', role = 'owner' where id = 'bbbbbbbb-0000-0000-0000-00000000000a';

insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', current_date, 'lead owner A', '11911110001', 'Outro'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', current_date, 'lead user A',  '11911110002', 'Outro'),
  ('bbbbbbbb-0000-0000-0000-00000000000a', current_date, 'lead owner B', '11911110001', 'Outro'); -- mesmo telefone: ok em outra empresa

do $$
declare n int;
begin
  -- slots: B tem 1 slot, já ocupado
  begin
    update user_profiles set tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000' where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
    raise exception 'FALHA: slot deveria bloquear';
  exception when others then
    if sqlerrm not like 'limite de usuarios%' then raise; end if;
  end;

  -- owner A: vê 2 leads (só empresa A)
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 2 then raise exception 'FALHA owner A viu %', n; end if;
  select count(*) into n from user_profiles; if n <> 2 then raise exception 'FALHA owner A perfis %', n; end if;
  execute 'reset role';

  -- user A: vê só o próprio
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA user A viu %', n; end if;
  begin
    update user_profiles set is_active = false where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
    raise exception 'FALHA: user alterou is_active';
  exception when others then
    if sqlerrm not like 'alteracao de is_active%' then raise; end if;
  end;
  execute 'reset role';

  -- owner B: vê 1
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA owner B viu %', n; end if;
  select count(*) into n from tenants; if n <> 1 then raise exception 'FALHA owner B tenants %', n; end if;
  execute 'reset role';

  -- user A desativado: vê 0
  perform set_config('request.jwt.claims', '', true);
  update user_profiles set is_active = false where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 0 then raise exception 'FALHA inativo viu %', n; end if;
  if public.acesso_crm() <> 'usuario_inativo' then raise exception 'FALHA acesso_crm'; end if;
  execute 'reset role';

  -- empresa B inativa: owner B vê 0
  perform set_config('request.jwt.claims', '', true);
  update tenants set is_active = false where id = 'bbbbbbbb-1111-0000-0000-000000000000';
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 0 then raise exception 'FALHA empresa inativa viu %', n; end if;
  execute 'reset role';

  -- superadmin visitando A: vê 2
  perform set_config('request.jwt.claims', '', true);
  update user_profiles set active_tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000' where id = '32b521df-53ed-433e-97d2-0a18ccda1964';
  perform set_config('request.jwt.claims', '{"sub":"32b521df-53ed-433e-97d2-0a18ccda1964","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 2 then raise exception 'FALHA superadmin em A viu %', n; end if;
  execute 'reset role';

  raise notice 'OK: todos os checks passaram';
end $$;

rollback;
```

**Step 1:** Rodar. Expected: `NOTICE: OK: todos os checks passaram` e nenhum `FALHA`.
**Step 2:** Se falhar, corrigir a migration correspondente (nova migration `..._fix_...`), rodar de novo.
**Step 3:** Rodar também contagem real do superadmin sem `active_tenant_id`: deve ver 4287 clientes.
**Step 4:** Commit `test(db): script de isolamento multitenant`.

---

## Fase 2 — Auth / app base

### Task 9: Tipos, helpers de role e contexto de servidor

**Files:**
- Modify: `src/types/crm.ts:5-19`
- Create: `src/lib/roles.ts`
- Create: `src/lib/tenant-server.ts`
- Modify: `src/lib/auth-helpers.ts` (usar `isSuperadmin`)

`src/types/crm.ts`:
```ts
// 'admin' = superadmin da plataforma (nome mantido no enum do banco).
export type UserRole = 'admin' | 'owner' | 'user'

export interface Tenant {
  id: string
  name: string
  max_users: number | null
  is_active: boolean
  branding: { primaryColor?: string | null } | null
}

export interface UserProfile {
  id: string
  role: UserRole
  tenant_id?: string | null
  is_active?: boolean
  active_tenant_id?: string | null
  // ...campos existentes
}
```

`src/lib/roles.ts`:
```ts
import type { UserRole } from '@/types/crm'

export const isSuperadmin = (role?: UserRole | null) => role === 'admin'
export const canManageTeam = (role?: UserRole | null) => role === 'admin' || role === 'owner'

export const roleLabel: Record<UserRole, string> = {
  admin: 'Superadmin',
  owner: 'Dono',
  user: 'Usuário',
}
```

`src/lib/tenant-server.ts`:
```ts
import { createClient } from '@/lib/supabase-server'
import type { UserRole } from '@/types/crm'

export type Caller = {
  userId: string
  role: UserRole
  tenantId: string | null   // empresa efetiva (visitada, p/ superadmin)
  ownTenantId: string | null
}

export async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: tenantId }] = await Promise.all([
    supabase.from('user_profiles').select('role, tenant_id, is_active').eq('id', user.id).single(),
    supabase.rpc('current_tenant_id'),
  ])
  if (!profile || !profile.is_active) return null

  return {
    userId: user.id,
    role: profile.role as UserRole,
    tenantId: (tenantId as string | null) ?? null,
    ownTenantId: profile.tenant_id,
  }
}

// Erros de trigger (slots) viram 409 com mensagem legível.
export function mensagemErroDb(message?: string): { status: number; error: string } {
  if (message?.includes('limite de usuarios')) return { status: 409, error: 'Limite de usuários da empresa atingido' }
  if (message?.includes('slots menor')) return { status: 409, error: 'Slots menor que o número de usuários ativos' }
  return { status: 500, error: 'Erro ao salvar' }
}
```

**Step 1:** Escrever arquivos. **Step 2:** `pnpm build` → passa (corrigir usos de `UserRole` com switch exaustivo, ex.: `Sidebar.tsx:80` → usar `roleLabel`). **Step 3:** Commit `feat: tipos e helpers de tenant`.

---

### Task 10: AuthContext carrega empresa

**Files:** Modify `src/contexts/AuthContext.tsx`

- Adicionar ao select de `user_profiles` (linha ~67): `tenant_id, is_active, active_tenant_id`.
- Após carregar perfil, buscar empresa efetiva:
```ts
const { data: tenantId } = await supabase.rpc('current_tenant_id')
const { data: tenant } = tenantId
  ? await supabase.from('tenants').select('id, name, max_users, is_active, branding').eq('id', tenantId).single()
  : { data: null }
```
- Expor no contexto: `tenant: Tenant | null` e `refreshProfile()` (reexecuta `fetchUserProfile`), usado após trocar empresa/cor.
- `company_name` do perfil passa a vir de `tenant?.name` (fallback atual).
- Remover `signUp` do contexto e do tipo `AuthContextType`.

**Step:** `pnpm build` → passa. Commit `feat: AuthContext expoe tenant`.

---

### Task 11: Remover signup público

**Files:** Modify `src/components/auth/LoginForm.tsx`

- Remover estado `isSignUp`, campo empresa, toggle "Crie sua conta agora" (linhas ~21, 33-45, 108-115, 136-150, 188-206) e `signUp` do `useAuth()`.
- Texto fixo: "Boas-vindas de volta". Abaixo do botão: "Acesso somente por convite."
- Apagar `src/components/auth/EmailConfirmation.tsx` se ficar sem uso (`grep -rn EmailConfirmation src`).

**Step:** build + abrir `/auth/login` no dev. Commit `feat: remove signup publico`.

---

### Task 12: Middleware + tela de conta desativada

**Files:**
- Modify: `middleware.ts:55-110`
- Create: `src/app/auth/desativado/page.tsx`

`middleware.ts`:
```ts
const publicPaths = ['/auth/login', '/auth/callback', '/auth/definir-senha', '/auth/desativado', '/privacidade', '/exclusao-de-dados', '/brandbook']
const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))
```
(Conferir antes se `/brandbook` e `/` landing devem ser públicos: `/` é a página de leads → **não** pública.)

Substituir leitura de perfil:
```ts
const { data: acesso } = await supabase.rpc('acesso_crm')
if (acesso !== 'ok') {
  const url = request.nextUrl.clone()
  url.pathname = '/auth/desativado'
  url.search = `?motivo=${acesso ?? 'sem_perfil'}`
  return NextResponse.redirect(url)
}

const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', data.user.id).single()
const role = profile?.role
if ((pathname.startsWith('/admin') || pathname.startsWith('/settings/users')) && role !== 'admin') {
  return redirectTo('/dashboard')
}
if (pathname.startsWith('/empresa') && role !== 'admin' && role !== 'owner') {
  return redirectTo('/dashboard')
}
```

`src/app/auth/desativado/page.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const MENSAGENS: Record<string, string> = {
  usuario_inativo: 'Sua conta foi desativada.',
  empresa_inativa: 'O acesso da sua empresa está desativado.',
  sem_empresa: 'Sua conta não está vinculada a nenhuma empresa.',
  sem_perfil: 'Não encontramos seu perfil.',
}

export default function DesativadoPage() {
  const motivo = useSearchParams().get('motivo') ?? 'sem_perfil'

  useEffect(() => {
    void createClient().auth.signOut()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-3">
          <CardTitle>Acesso indisponível</CardTitle>
          <CardDescription>
            {MENSAGENS[motivo] ?? MENSAGENS.sem_perfil} Entre em contato com o administrador.
          </CardDescription>
          <Button variant="outline" onClick={() => { window.location.href = '/auth/login' }}>
            Voltar ao login
          </Button>
        </CardHeader>
      </Card>
    </div>
  )
}
```
(Envolver em `<Suspense>` se o build reclamar de `useSearchParams`.)

**Step 1:** build. **Step 2:** dev: logado, acessar `/`, `/dashboard` → ok; deslogado, acessar `/dashboard` → redirect login (antes passava). **Step 3:** Commit `fix: middleware protege rotas e bloqueia contas desativadas`.

---

### Task 13: Definir senha (convite) + template de email

**Files:** Create `src/app/auth/definir-senha/page.tsx`

```tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const supabase = createClient()

function DefinirSenha() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<'verificando' | 'pronto' | 'erro'>('verificando')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const token_hash = params.get('token_hash')
    if (!token_hash) { setStatus('erro'); return }
    supabase.auth.verifyOtp({ token_hash, type: 'invite' })
      .then(({ error }) => setStatus(error ? 'erro' : 'pronto'))
  }, [params])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha.length < 8) return setErro('Mínimo 8 caracteres')
    if (senha !== confirmacao) return setErro('Senhas não conferem')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) return setErro(error.message)
    router.replace('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crie sua senha</CardTitle>
          <CardDescription>
            {status === 'verificando' && 'Validando convite...'}
            {status === 'erro' && 'Convite inválido ou expirado. Peça um novo convite ao administrador.'}
            {status === 'pronto' && 'Defina a senha para acessar o CRM.'}
          </CardDescription>
        </CardHeader>
        {status === 'pronto' && (
          <CardContent>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacao">Confirmar senha</Label>
                <Input id="confirmacao" type="password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button type="submit" className="w-full" disabled={salvando}>Salvar e entrar</Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default function Page() {
  return <Suspense><DefinirSenha /></Suspense>
}
```

**Manual (usuário, dashboard Supabase → Authentication):**
0. Sign In / Providers → desligar "Allow new users to sign up" (app financeiro desativado; convite continua funcionando).
1. URL Configuration → Redirect URLs: adicionar `https://prizely.com.br/auth/definir-senha`, `https://www.prizely.com.br/auth/definir-senha`, `http://localhost:3000/auth/definir-senha`.
2. Emails → Invite user. Assunto: `Convite para o CRM {{ .Data.company_name }}`. Corpo:
```html
<h2>Você foi convidado(a) para o CRM da {{ .Data.company_name }}</h2>
<p>Olá {{ .Data.full_name }},</p>
<p>Clique no botão abaixo para criar sua senha e acessar.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Aceitar convite</a></p>
<p>Se você não esperava este convite, ignore este email.</p>
```

**Step:** build. Commit `feat: pagina de definir senha para convites`.

---

## Fase 3 — Minha empresa

### Task 14: APIs da empresa

**Files:**
- Create: `src/app/api/empresa/route.ts` (GET info, PATCH cor)
- Create: `src/app/api/empresa/usuarios/route.ts` (GET lista, POST convite)
- Create: `src/app/api/empresa/usuarios/[id]/route.ts` (PATCH `is_active`)
- Create: `src/app/api/empresa/usuarios/[id]/reenviar/route.ts` (POST)

`src/app/api/empresa/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'

const HEX = /^#[0-9a-fA-F]{6}$/

export async function PATCH(request: NextRequest) {
  const caller = await getCaller()
  if (!caller?.tenantId || !canManageTeam(caller.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { primaryColor } = await request.json().catch(() => ({}))
  if (primaryColor !== null && !HEX.test(primaryColor ?? '')) {
    return NextResponse.json({ error: 'Cor inválida (use #RRGGBB)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: atual } = await admin.from('tenants').select('branding').eq('id', caller.tenantId).single()
  const branding = { ...((atual?.branding as Record<string, unknown>) ?? {}), primaryColor }

  const { error } = await admin.from('tenants').update({ branding }).eq('id', caller.tenantId)
  if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  return NextResponse.json({ branding })
}
```

`src/app/api/empresa/usuarios/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, mensagemErroDb } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'

// GET /api/empresa/usuarios[?ativos=1] — equipe da empresa atual.
export async function GET(request: NextRequest) {
  const caller = await getCaller()
  if (!caller?.tenantId || !canManageTeam(caller.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = await createClient()
  let query = supabase
    .from('user_profiles')
    .select('id, role, full_name, is_active, created_at')
    .eq('tenant_id', caller.tenantId)
    .order('full_name')
  if (request.nextUrl.searchParams.get('ativos') === '1') query = query.eq('is_active', true)

  const { data: perfis, error } = await query
  if (error) return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })

  // Emails e status de convite vêm do auth (service role).
  const admin = createAdminClient()
  const usuarios = await Promise.all((perfis ?? []).map(async (p) => {
    const { data } = await admin.auth.admin.getUserById(p.id)
    return {
      ...p,
      email: data.user?.email ?? null,
      convite_pendente: !data.user?.last_sign_in_at,
    }
  }))

  const { data: tenant } = await supabase.from('tenants').select('max_users').eq('id', caller.tenantId).single()
  return NextResponse.json({
    usuarios,
    slots: { usados: usuarios.filter(u => u.is_active).length, total: tenant?.max_users ?? null },
  })
}

// POST /api/empresa/usuarios { email, full_name } — convida p/ empresa atual.
export async function POST(request: NextRequest) {
  const caller = await getCaller()
  if (!caller?.tenantId || !canManageTeam(caller.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { email, full_name } = await request.json().catch(() => ({}))
  if (!email || !full_name) {
    return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: tenant } = await admin.from('tenants').select('name, max_users').eq('id', caller.tenantId).single()
  const { count } = await admin.from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', caller.tenantId).eq('is_active', true)
  if (tenant?.max_users != null && (count ?? 0) >= tenant.max_users) {
    return NextResponse.json({ error: 'Limite de usuários da empresa atingido' }, { status: 409 })
  }

  const redirectTo = `${request.nextUrl.origin}/auth/definir-senha`
  const { data: convite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name, company_name: tenant?.name },
  })
  if (inviteError || !convite.user) {
    const jaExiste = inviteError?.message?.toLowerCase().includes('already')
    if (!jaExiste) return NextResponse.json({ error: 'Erro ao enviar convite' }, { status: 500 })

    // Conta já existe (ex.: antigo app financeiro). Reaproveita se não tiver empresa.
    const existente = await buscarUsuarioPorEmail(admin, email)
    const { data: perfil } = existente
      ? await admin.from('user_profiles').select('tenant_id').eq('id', existente.id).single()
      : { data: null }
    if (!existente || perfil?.tenant_id) {
      return NextResponse.json({ error: 'Email já pertence a outra empresa' }, { status: 409 })
    }
    const { error } = await admin.from('user_profiles')
      .upsert({ id: existente.id, tenant_id: caller.tenantId, role: 'user', full_name, is_active: true })
    if (error) {
      const r = mensagemErroDb(error.message)
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    return NextResponse.json({ id: existente.id, reaproveitado: true }, { status: 201 })
  }

  // handle_new_user criou o perfil sem empresa; vincula agora.
  const { error: perfilError } = await admin.from('user_profiles')
    .update({ tenant_id: caller.tenantId, role: 'user', full_name, is_active: true })
    .eq('id', convite.user.id)
  if (perfilError) {
    await admin.auth.admin.deleteUser(convite.user.id)
    const { status, error } = mensagemErroDb(perfilError.message)
    return NextResponse.json({ error }, { status })
  }

  return NextResponse.json({ id: convite.user.id }, { status: 201 })
}
```

`buscarUsuarioPorEmail` (em `src/lib/convite.ts`, criado já aqui):
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

// Admin API não tem busca por email; pagina listUsers (base pequena).
export async function buscarUsuarioPorEmail(admin: SupabaseClient, email: string) {
  const alvo = email.trim().toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return null
    const achado = data.users.find(u => u.email?.toLowerCase() === alvo)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
  return null
}
```
Usuário reaproveitado entra com a senha que já tinha (sem email de convite); UI mostra "Usuário existente vinculado — ele entra com a senha atual".

`src/app/api/empresa/usuarios/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, mensagemErroDb } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'

// PATCH { is_active } — owner/superadmin ativa/desativa usuário da empresa atual.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller?.tenantId || !canManageTeam(caller.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  if (id === caller.userId) {
    return NextResponse.json({ error: 'Você não pode desativar a si mesmo' }, { status: 400 })
  }

  const { is_active } = await request.json().catch(() => ({}))
  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active (boolean) é obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: alvo } = await admin.from('user_profiles').select('tenant_id, role').eq('id', id).single()
  if (!alvo || alvo.tenant_id !== caller.tenantId || alvo.role === 'admin') {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const { error } = await admin.from('user_profiles').update({ is_active }).eq('id', id)
  if (error) {
    const { status, error: msg } = mensagemErroDb(error.message)
    return NextResponse.json({ error: msg }, { status })
  }
  return NextResponse.json({ id, is_active })
}
```

`src/app/api/empresa/usuarios/[id]/reenviar/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCaller } from '@/lib/tenant-server'
import { canManageTeam } from '@/lib/roles'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await getCaller()
  if (!caller?.tenantId || !canManageTeam(caller.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: alvo } = await admin.from('user_profiles').select('tenant_id, full_name').eq('id', id).single()
  if (!alvo || alvo.tenant_id !== caller.tenantId) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }
  const { data: auth } = await admin.auth.admin.getUserById(id)
  if (!auth.user?.email) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  if (auth.user.last_sign_in_at) {
    return NextResponse.json({ error: 'Usuário já aceitou o convite' }, { status: 409 })
  }

  const { data: tenant } = await admin.from('tenants').select('name').eq('id', caller.tenantId).single()
  const { error } = await admin.auth.admin.inviteUserByEmail(auth.user.email, {
    redirectTo: `${request.nextUrl.origin}/auth/definir-senha`,
    data: { full_name: alvo.full_name, company_name: tenant?.name },
  })
  if (error) return NextResponse.json({ error: 'Erro ao reenviar convite' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```
> Se `inviteUserByEmail` recusar reenvio p/ usuário existente não confirmado, trocar por `admin.auth.admin.generateLink({ type: 'invite', email })` — mas esse **não envia email**; nesse caso retornar o link na resposta p/ o owner copiar. Validar no Step 2.

**Step 1:** build.
**Step 2:** Manual com `curl`/browser logado como superadmin: GET lista 11; POST convite p/ email de teste → email chega com nome da empresa; reenviar → ok; PATCH desativar a si mesmo → 400.
**Step 3:** Commit `feat: apis de gestao da empresa`.

---

### Task 15: Página `/empresa`

**Files:** Create `src/app/empresa/page.tsx`

Estrutura (seguir padrão de `src/app/settings/users/page.tsx`: `ProtectedRoute` + `MainLayout` + Card/Table/Dialog/Switch):

- Header: `tenant.name` (de `useAuth()`), subtítulo "Minha empresa".
- Card "Aparência": `<input type="color">` + campo texto hex + preview (botão `bg-primary` com a cor) + "Restaurar padrão" (`primaryColor: null`). Salvar → `PATCH /api/empresa` → `refreshProfile()`.
- Card "Usuários": título com `Badge` `{slots.usados}/{slots.total} slots`. Botão "Convidar usuário" (desabilitado se cheio) → Dialog nome+email → `POST /api/empresa/usuarios`. Tabela: nome, email, papel (`roleLabel`), status (Ativo/Inativo/Convite pendente), `Switch` ativo (desabilitado na própria linha e em role `admin`), botão "Reenviar convite" quando `convite_pendente`.
- Erros: `alert(msg)` (convenção atual do projeto).
- Guard client: `if (!canManageTeam(userProfile?.role)) router.push('/dashboard')`.

**Step 1:** Escrever página. **Step 2:** build + dev: owner vê equipe, convida, desativa; contador atualiza; convite bloqueado ao atingir slots. **Step 3:** Commit `feat: pagina minha empresa`.

---

### Task 16: Tema por empresa

**Files:**
- Create: `src/lib/color.ts`
- Create: `src/components/layout/TenantTheme.tsx`
- Modify: `src/app/layout.tsx` (renderizar `<TenantTheme />` dentro de `AuthProvider`)

`src/lib/color.ts`:
```ts
// "#RRGGBB" -> "H S% L%" (formato das CSS vars do Tailwind em globals.css)
export function hexToHslTriplet(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export const fmtHsl = ({ h, s, l }: { h: number; s: number; l: number }) => `${h} ${s}% ${l}%`

// Texto sobre a cor: escuro se a cor for clara.
export const foregroundFor = (l: number) => (l > 60 ? '40 20% 9%' : '38 40% 97%')
```

`src/components/layout/TenantTheme.tsx`:
```tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { fmtHsl, foregroundFor, hexToHslTriplet } from '@/lib/color'

export default function TenantTheme() {
  const { tenant } = useAuth()
  const hex = tenant?.branding?.primaryColor
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null

  const base = hexToHslTriplet(hex)
  const dark = { ...base, l: Math.min(base.l + 10, 75) }

  const css = `
:root{--primary:${fmtHsl(base)};--ring:${fmtHsl(base)};--primary-foreground:${foregroundFor(base.l)};}
.dark{--primary:${fmtHsl(dark)};--ring:${fmtHsl(dark)};--primary-foreground:${foregroundFor(dark.l)};}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
```
(Hex validado por regex no cliente e na API → sem injeção de CSS.)

**Step 1:** build. **Step 2:** dev: salvar cor em `/empresa` → botões/links mudam; alternar dark → variante clara; "Restaurar padrão" volta ao marrom Prizely. **Step 3:** Commit `feat: cor primaria por empresa`.

---

### Task 17: Ajustar checks de role existentes

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:36-50,80-86,134-156`
- Modify: `src/app/page.tsx:47-55`
- Modify: `src/app/settings/users/page.tsx` (remover criação com senha/dialog; manter lista + assistente; badge via `roleLabel`)
- Modify: `src/app/api/admin/users/route.ts` (remover `POST`; `GET` inclui `tenant_id`, `is_active`)
- Modify: `src/lib/auth-helpers.ts` (`checkIsAdmin` → `isSuperadmin`)

Sidebar `NavLinks`:
```ts
const { userProfile } = useAuth()
const superadmin = isSuperadmin(userProfile?.role)
const navItems = [
  { href: '/', label: 'Leads' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/dashboard', label: 'Painel' },
  { href: '/calendario', label: 'Agenda' },
  { href: '/settings/integrations', label: 'Integrações' },
  ...(canManageTeam(userProfile?.role) ? [{ href: '/empresa', label: 'Minha empresa' }] : []),
  ...(superadmin ? [
    { href: '/admin/empresas', label: 'Empresas' },
    { href: '/admin', label: 'Administração' },
    { href: '/settings/users', label: 'Usuários (global)' },
    { href: '/admin/google-calendar', label: 'Google Calendar' },
  ] : []),
]
```
Badge de role (`getRoleBadge`): usar `roleLabel[userProfile.role]`. Nome da empresa no rodapé: `tenant?.name`.

"Visualizar como" (`SidebarBody`): trocar `isAdmin` por `canManageTeam(role)` e fetch por `/api/empresa/usuarios?ativos=1` (`data.usuarios`, mapear `company_name: u.full_name`). Refazer fetch quando `tenant?.id` mudar.

`src/app/page.tsx`: `isAdmin` → `canManageTeam(userProfile?.role)`; fetch de nomes → `/api/empresa/usuarios` (inclui inativos, p/ exibir nome em leads antigos).

Calendário/Google Calendar/WAHA: **sem mudança** (continuam superadmin via `'admin'`).

**Step 1:** `grep -rn "api/admin/users" src` → só `settings/users` e `admin/page.tsx` restam.
**Step 2:** build. **Step 3:** Commit `feat: menus e equipe por empresa`.

---

## Fase 4 — Superadmin

### Task 18: APIs de superadmin

**Files:**
- Create: `src/app/api/admin/empresas/route.ts` (GET lista, POST cria)
- Create: `src/app/api/admin/empresas/[id]/route.ts` (PATCH nome/slots/ativo/dono)
- Create: `src/app/api/admin/empresa-ativa/route.ts` (POST troca empresa visitada)

Helper comum no topo de cada rota:
```ts
const caller = await getCaller()
if (!caller || !isSuperadmin(caller.role)) {
  return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
}
```

`GET /api/admin/empresas`: via admin client:
```ts
const { data: tenants } = await admin.from('tenants').select('id, name, max_users, is_active, created_at').order('name')
const { data: perfis } = await admin.from('user_profiles').select('id, full_name, role, tenant_id, is_active')
const empresas = (tenants ?? []).map(t => {
  const membros = (perfis ?? []).filter(p => p.tenant_id === t.id)
  return {
    ...t,
    ativos: membros.filter(m => m.is_active).length,
    donos: membros.filter(m => m.role === 'owner' || m.role === 'admin').map(m => ({ id: m.id, full_name: m.full_name })),
  }
})
return NextResponse.json({ empresas })
```

`POST /api/admin/empresas` `{ name, max_users, dono: { user_id } | { email, full_name } }`:
1. Validar `name` (não vazio), `max_users` (inteiro ≥ 1).
2. `slug = slugify(name) + '-' + crypto.randomUUID().slice(0, 6)` (regex `^[a-z0-9-]+$`; slugify: `normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')`).
3. Insert tenant `{ name, slug, max_users, is_active: true, branding: {} }`.
4. Dono existente (`user_id`): `update user_profiles set tenant_id, role='owner', is_active=true` (se `role === 'admin'`, não muda role: superadmin continua admin e vira dono pela visita). Dono novo: mesmo fluxo de convite da Task 14 com `role: 'owner'`.
5. Se passo 4 falhar: deletar tenant criado, retornar erro (`mensagemErroDb`).

Extrair a lógica de convite da Task 14 (incluindo reaproveitamento) para `src/lib/convite.ts` (`convidarUsuario({ admin, email, full_name, tenantId, role, origin })`) e usar nos dois lugares.

`PATCH /api/admin/empresas/[id]` `{ name?, max_users?, is_active?, owner_id? }`:
- `name`, `max_users`, `is_active` → `update tenants` (trigger valida slots → `mensagemErroDb`).
- `owner_id` → usuário precisa ter `tenant_id = id`; rebaixa owners atuais da empresa p/ `user` e promove o novo (`role='owner'`). Não mexe em `admin`.
- Bloquear `is_active=false` na empresa própria do superadmin.

`POST /api/admin/empresa-ativa` `{ tenant_id | null }`: valida que tenant existe; `update user_profiles set active_tenant_id = tenant_id where id = caller.userId` (admin client). `null` = voltar à própria.

**Step 1:** build. **Step 2:** curl/manual: criar empresa com dono novo (email teste) → convite chega; slots < ativos → 409; trocar empresa ativa → `/` mostra leads da outra. **Step 3:** Commit `feat: apis superadmin de empresas`.

---

### Task 19: Páginas `/admin/empresas`

**Files:**
- Create: `src/app/admin/empresas/page.tsx`
- Create: `src/app/admin/empresas/[id]/page.tsx`

Lista: Table (Empresa, Donos, `ativos/max_users`, Status badge, botão "Abrir"). Botão "Nova empresa" → Dialog: nome, slots, dono (Tabs "Usuário existente" com Select de `/api/admin/users` | "Convidar novo" com nome+email).

Detalhe: formulário nome + slots (Salvar), Switch "Empresa ativa", Select "Dono" (usuários da empresa via `/api/admin/users` filtrando `tenant_id`), botão "Gerenciar usuários" → `POST /api/admin/empresa-ativa` → `refreshProfile()` → `router.push('/empresa')`.

Padrão visual: igual `src/app/admin/page.tsx` (ProtectedRoute + MainLayout + Card). Guard `isSuperadmin`.

**Step 1:** build. **Step 2:** dev: fluxo completo criar → editar slots → desativar empresa → login do dono mostra `/auth/desativado?motivo=empresa_inativa`. **Step 3:** Commit `feat: painel superadmin de empresas`.

---

### Task 20: Seletor de empresa + badge "Visitando"

**Files:**
- Create: `src/components/layout/EmpresaSwitcher.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (renderizar abaixo do logo, só superadmin)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { isSuperadmin } from '@/lib/roles'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Opcao = { id: string; name: string }

export default function EmpresaSwitcher() {
  const { userProfile, tenant, refreshProfile } = useAuth()
  const [empresas, setEmpresas] = useState<Opcao[]>([])
  const superadmin = isSuperadmin(userProfile?.role)

  useEffect(() => {
    if (!superadmin) return
    fetch('/api/admin/empresas').then(r => r.ok ? r.json() : null).then(d => setEmpresas(d?.empresas ?? []))
  }, [superadmin])

  if (!superadmin || !tenant) return null
  const visitando = tenant.id !== userProfile?.tenant_id

  const trocar = async (id: string) => {
    const res = await fetch('/api/admin/empresa-ativa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: id === userProfile?.tenant_id ? null : id }),
    })
    if (!res.ok) return alert('Erro ao trocar de empresa')
    await refreshProfile()
    window.location.href = '/'
  }

  return (
    <div className="flex flex-col gap-2">
      <Select value={tenant.id} onValueChange={trocar}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {visitando && <Badge variant="destructive" className="w-fit">Visitando: {tenant.name}</Badge>}
    </div>
  )
}
```
(`window.location.href` força reload: hooks de dados recarregam com o novo tenant.)

**Step 1:** build. **Step 2:** dev: trocar p/ empresa teste → badge aparece, leads da empresa; criar lead → aparece só lá; voltar p/ Prizely → 4287+ leads. **Step 3:** Commit `feat: seletor de empresa para superadmin`.

---

### Task 21: Docs

**Files:** Modify `CLAUDE.md`, `REFACTOR-PLAN.md`, `docs/plans/2026-09-30-multitenant-design.md`

- `CLAUDE.md`: "Single-tenant" → "Multitenant por empresa (RLS)". Seção Auth: roles `admin` (superadmin), `owner`, `user`; funções `current_tenant_id()`, `is_tenant_owner()`, `is_superadmin()`, `acesso_crm()`; convite; `/empresa`, `/admin/empresas`. Remover nota "tenant_id cleanup planned for Fase 2".
- `REFACTOR-PLAN.md`: riscar itens da Fase 2 que removem `tenant_id`/`tenants`/filtro de RLS, com nota "revertido em 2026-09-30, ver docs/plans/2026-09-30-multitenant-design.md".
- Design doc: seção "Decisões técnicas" deste plano (enum `admin`, tenant canônico, dedup por empresa, `/settings/users` mantido).

Commit `docs: multitenant`.

---

### Task 22: Verificação final

1. Rodar `supabase/tests/multitenant_rls.sql` de novo → OK.
2. `get_advisors` security → sem novos erros.
3. `pnpm build` → passa. `pnpm lint` → não piorar os 6 erros pré-existentes.
4. Checklist manual (dev, contas reais + 1 empresa teste):
   - [ ] Deslogado em `/dashboard` → login.
   - [ ] Superadmin vê 4287+ leads Prizely; troca p/ teste → 0; cria lead lá; volta.
   - [ ] Owner teste: vê só a própria empresa; "Minha empresa" visível; "Empresas" não.
   - [ ] Convite chega em pt-BR com nome da empresa; definir senha → entra.
   - [ ] Slots cheios → botão convidar desabilitado + API 409.
   - [ ] Desativar usuário → some de "Visualizar como"; login → tela desativado; slot liberado.
   - [ ] Leads do desativado continuam visíveis p/ owner.
   - [ ] Desativar empresa → dono bloqueado.
   - [ ] Cor primária aplica em light/dark; restaurar padrão.
   - [ ] Webhook WhatsApp/Instagram cria lead no tenant certo (checar `tenant_id` do último lead após mensagem de teste).
   - [ ] Mesmo telefone em 2 empresas → 2 leads distintos.
5. Usar superpowers:finishing-a-development-branch.
