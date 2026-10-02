# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Prizely — CRM for customer management. Portuguese-language interface (lang="pt-BR"). Multitenant por empresa (tabela `tenants`), isolamento via RLS — ver `docs/plans/2026-09-30-multitenant-design.md`.

## Commands
- `pnpm dev` — dev server on localhost:3000
- `pnpm build` — production build (strict TS checking enabled)
- `pnpm lint` — ESLint
- `pnpm test` — Vitest (funções puras, `src/**/*.test.ts`)

## Stack
- Next.js 16 (App Router), React 19, TypeScript (strict)
- Supabase (auth via `@supabase/ssr`, DB, realtime)
- TailwindCSS 3 + Radix UI primitives + shadcn/ui (`components/ui/`)
- Recharts for dashboard charts

## Architecture

### Auth
- **Middleware** (`middleware.ts` at project root, NOT in `src/`): Supabase SSR auth, redirects unauthenticated users to `/auth/login`. Public paths (exact or sub-path): `/auth/login`, `/auth/callback`, `/auth/definir-senha`, `/auth/desativado`, `/privacidade`, `/exclusao-de-dados`, `/brandbook`. Calls RPC `acesso_crm()`; inactive user/company → `/auth/desativado`. `/` redireciona p/ `homePath(role)`; demais rotas guardadas por `areaDaRota` + `pode` (fora da área → home do perfil).
- **Two Supabase clients**: `supabase-browser.ts` (client components), `supabase-server.ts` (server components/actions). Plus `supabase-admin.ts` (service role, server-only).
- **Roles**: `admin` (= superadmin; nome mantido no enum), `owner` (dono), `gestor` (gestor de tráfego), `vendedor`, `user` (= Artista) — `src/types/crm.ts`. Matriz única em `src/lib/permissions.ts` (`pode(role, area)`, `homePath`, `areaDaRota`) usada por Sidebar, middleware e APIs; labels/convite em `src/lib/roles.ts`. Design: `docs/plans/2026-10-01-perfis-acesso-design.md`.
- **Multitenant**: `user_profiles.tenant_id` (empresa), `is_active`, `active_tenant_id` (empresa visitada: superadmin qualquer; owner só as vinculadas em `tenant_owners`, que não ocupam slot; inativa cai p/ primária). SQL: `current_tenant_id()`, `effective_tenant_id()`, `ve_empresa_toda()` (leitura: admin/owner/gestor), `is_tenant_owner()` (escrita/gestão: admin/owner), `responsavel_valido()`, `is_superadmin()`, `acesso_crm()`, `definir_dono()`. `tenant_id` de clientes/negociacoes/follow_ups preenchido por trigger. Slots = usuários ativos ≤ `tenants.max_users` (trigger). Server: `getCaller()` em `src/lib/tenant-server.ts`. Visibilidade: artista só os próprios leads; vendedor vê/opera os leads dos artistas que atende (`atende_artista()`, `pode_ver_lead()`/`pode_operar_lead()` nas policies); gestor lê a empresa e só altera os próprios; owner/superadmin leem e alteram a empresa.
- **Contas só por convite** (sem signup): `src/lib/convite.ts` + `/auth/definir-senha`. Env `NEXT_PUBLIC_SITE_URL` define o link. Os templates Supabase de convite e recuperação usam `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite|recovery`.
- **Context**: `AuthContext` (user/session/profile/tenant, `refreshProfile()`), `AdminContext` ("Visualizar como"). `'use client'`.

### Data Model (all types in `src/types/crm.ts`)
- `Cliente` — CRM contact with origem, resultado, pagamento fields, follow-ups.
- `FollowUp` — follow-up notes per cliente.
- `UserProfile` — user profile with role.

### API Routes (`src/app/api/`)
Endpoints: `admin/users`, `admin/empresas`, `admin/empresa-ativa`, `empresa/`, `empresa/usuarios`, `clientes/`, `followups/`, `ocr/vision`, `user/profile`, `empresa/meta`, `cron/meta-events`. Rotas de gestão autorizam via `getCaller()` e escrevem com service role sempre escopado ao tenant.

### Pages
- `/` — redireciona p/ home do perfil (owner/gestor → `/equipe`, artista → `/clientes`, vendedor → `/atendimento`, superadmin → `/admin/empresas`)
- `/atendimento` — home do vendedor: escolhe artista que atende (`vendedor_artistas`, vinculado pelo dono em `/empresa`); opera sempre "visualizando como" o artista (persistido em sessionStorage; sem artista, `MainLayout` manda p/ cá)
- `/equipe` — home do dono e do gestor (área `ver_artistas`): cards dos artistas ativos c/ métricas do mês (RPC `dashboard_equipe`); clique = "Visualizar como" + `/dashboard`
- `/leads` — leads (tabela + filtros + modal); `/leads/[id]` detalhe (somente leitura p/ gestor em lead alheio)
- `/clientes` — clientes com venda em cards; clique abre `/leads/[id]`
- `/settings/integrations` — todos (WhatsApp/Instagram pessoais; menu "Minhas conexões" p/ vendedor/artista) + card Meta (gestor/superadmin)
- `/dashboard` — dashboard with charts and KPIs
- `/empresa` — minha empresa: cor primária + usuários/convites com papel (owner/superadmin)
- `/admin`, `/admin/empresas` — painel superadmin (empresas, slots, dono)
- `/settings/users` — usuários globais + assistente (superadmin)
- `/auth/login`, `/auth/callback`, `/auth/definir-senha`, `/auth/desativado`

### Key Patterns
- `'use client'` for all interactive components
- Custom hooks in `src/hooks/` wrap API calls (useClientes, useFollowUps, useNotifications, etc.)
- `lib/api.ts` — shared fetch helpers for API routes
- shadcn/ui components in `src/components/ui/`

### Meta CAPI
- Trigger `meta_enfileirar_negociacao` em `negociacoes` grava Contact/Lead/Purchase em `meta_event_outbox` (só leads de anúncio: origem `Anúncio*` ou `meta_ad_id`; idempotente por `event_id`).
- pg_cron (5 min) + pg_net chamam `/api/cron/meta-events` (`META_CRON_SECRET`; URL/segredo no Vault: `meta_cron_url`, `meta_cron_secret`). Envio em `src/lib/meta-outbox.ts` / `src/lib/meta-capi.ts`.
- Config em `meta_integrations`: padrão da empresa (`user_id` null) ou própria do usuário (tatuador com conta de anúncio própria); `meta_integracao_efetiva(tenant, user)` escolhe pelo dono do lead (`meta_event_outbox.user_id`). Token no Vault por integração (`meta_salvar_token`/`meta_ler_token`, só service role). Card em `/settings/integrations`, gestor/superadmin.
- Teste: `supabase/tests/meta_outbox.sql`. Design: `docs/plans/2026-10-01-meta-capi-design.md`.

## Path Aliases
`@/*` → `./src/*`

## Database

### Supabase (Primary)
Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
Migrations in `supabase/migrations/`. Backup scripts in `supabase/backup-db.sh`.
Migrations em `supabase/migrations/` podem divergir do banco — conferir `pg_policies`. Teste de isolamento: `supabase/tests/multitenant_rls.sql`. FKs `tenant_id` são `ON DELETE RESTRICT`.

## Styling
- Dark mode via classe `.dark` no `<html>`
- Cor primária por empresa: `TenantTheme` sobrescreve `--primary`/`--ring`/`--accent`/`--chart-1`
- Typography: classes utilitárias do Tailwind (`text-sm`, `text-lg`…). Não há
  escala tipográfica customizada — este arquivo já documentou `f-h1`…`f-h6`, que
  nunca existiram no código.
- Superfícies "Liquid Glass": `glass-floating`, `glass-control`
- Custom spacing tokens: `sidebar-width`, `header-height`

## Refactoring
See `REFACTOR-PLAN.md`. Remoção de multi-tenant foi revertida em 2026-09-30.
