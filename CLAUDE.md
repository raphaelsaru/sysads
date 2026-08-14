# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Prizely — CRM for customer management. Portuguese-language interface (lang="pt-BR"). Single-tenant (multi-tenant removed in Fase 1 refactor).

## Commands
- `pnpm dev` — dev server on localhost:3000
- `pnpm build` — production build (strict TS checking enabled)
- `pnpm lint` — ESLint

## Stack
- Next.js 16 (App Router), React 19, TypeScript (strict)
- Supabase (auth via `@supabase/ssr`, DB, realtime)
- TailwindCSS 3 + Radix UI primitives + shadcn/ui (`components/ui/`)
- Recharts for dashboard charts

## Architecture

### Auth
- **Middleware** (`middleware.ts` at project root, NOT in `src/`): Supabase SSR auth, redirects unauthenticated users to `/auth/login`. Public paths: `/`, `/auth/*`.
- **Two Supabase clients**: `supabase-browser.ts` (client components), `supabase-server.ts` (server components/actions). Plus `supabase-admin.ts` (service role, server-only).
- **Roles**: `admin`, `user` — defined in `src/types/crm.ts`.
- **Context**: `AuthContext` (user/session/profile). `'use client'`.

### Data Model (all types in `src/types/crm.ts`)
- `Cliente` — CRM contact with origem, resultado, pagamento fields, follow-ups.
- `FollowUp` — follow-up notes per cliente.
- `UserProfile` — user profile with role.

### API Routes (`src/app/api/`)
Endpoints: `admin/users`, `clientes/`, `followups/`, `ocr/vision`, `user/profile`. All use Supabase server client.

### Pages
- `/` — leads management (main page with table + filters + modal)
- `/clientes` — clients with closed sales (filtered view)
- `/dashboard` — dashboard with charts and KPIs
- `/admin` — admin panel (admin role only)
- `/settings/users` — user management (admin role only)
- `/auth/login`, `/auth/signup`, `/auth/callback`

### Key Patterns
- `'use client'` for all interactive components
- Custom hooks in `src/hooks/` wrap API calls (useClientes, useFollowUps, useNotifications, etc.)
- `lib/api.ts` — shared fetch helpers for API routes
- shadcn/ui components in `src/components/ui/`

## Path Aliases
`@/*` → `./src/*`

## Database

### Supabase (Primary)
Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
Migrations in `supabase/migrations/`. Backup scripts in `supabase/backup-db.sh`.
Note: DB still has tenant_id columns and RLS policies from multi-tenant era — cleanup planned for Fase 2.

## Styling
- Dark mode via `[data-pc-theme="dark"]` class selector
- Typography: classes utilitárias do Tailwind (`text-sm`, `text-lg`…). Não há
  escala tipográfica customizada — este arquivo já documentou `f-h1`…`f-h6`, que
  nunca existiram no código.
- Superfícies "Liquid Glass": `glass-floating`, `glass-control`
- Custom spacing tokens: `sidebar-width`, `header-height`

## Refactoring
See `REFACTOR-PLAN.md` for the 4-phase plan. Fase 1 (multi-tenant removal, dead code cleanup) is complete.
