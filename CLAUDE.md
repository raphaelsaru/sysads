# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Prizely — multitenant CRM for customer management. Portuguese-language interface (lang="pt-BR"). Built for "Charbelle" but supports multiple tenants.

## Commands
- `pnpm dev` — dev server on localhost:3000
- `pnpm build` — production build (note: `typescript.ignoreBuildErrors: true` in next.config.ts)
- `pnpm lint` — ESLint
- `pnpm storybook` — Storybook on localhost:6006
- `pnpm vitest` — runs Storybook-based browser tests via Playwright/Chromium

## Stack
- Next.js 16 (App Router), React 19, TypeScript (strict)
- Supabase (auth via `@supabase/ssr`, DB, realtime)
- TailwindCSS 3 + Radix UI primitives + shadcn/ui (`components/ui/`)
- Recharts for dashboard charts
- Storybook 9 + Vitest (browser mode) for component testing

## Architecture

### Auth & Multitenancy
- **Middleware** (`middleware.ts` at project root, NOT in `src/`): Supabase SSR auth, redirects unauthenticated users to `/auth/login`. Public paths: `/`, `/auth/*`.
- **Three Supabase clients**: `supabase-browser.ts` (client components), `supabase-server.ts` (server components/actions), `supabase.ts` (singleton with custom timeout, legacy).
- **Roles**: `admin_global`, `tenant_admin`, `tenant_user` — defined in `src/types/crm.ts`.
- **Contexts**: `AuthContext` (user/session/profile), `TenantContext` (tenant data/branding/OCR toggle), `AdminContext` (admin panel state). All are `'use client'`.
- Tenant branding applies dynamic colors via `lib/color-utils.ts` + `ThemeApplier.tsx`.

### Data Model (all types in `src/types/crm.ts`)
- `Cliente` — CRM contact with origem, resultado, pagamento fields, follow-ups, tenant_id.
- `FollowUp` — follow-up notes per cliente.
- `Tenant` — tenant with branding, settings, limits (max_clients, max_users).
- `UserProfile` — user profile with role and tenant association.

### API Routes (`src/app/api/`)
Endpoints: `admin/`, `clientes/`, `followups/`, `ocr/`, `quote/`, `tenant/`, `user/`. All use Supabase server client.

### Pages
- `/dashboard` — main dashboard with charts
- `/clientes` — client management (table + form + modal)
- `/admin` — global admin panel, tenant management (`admin/tenants/`)
- `/settings/branding` — tenant branding config
- `/settings/users` — user management
- `/onboarding` — new tenant setup flow
- `/auth/login`, `/auth/signup`, `/auth/callback`

### Key Patterns
- `'use client'` for all interactive components
- Custom hooks in `src/hooks/` wrap API calls (useClientes, useFollowUps, useNotifications, etc.)
- `lib/api.ts` — shared fetch helpers for API routes
- `lib/db.ts` — direct PostgreSQL via `pg` (used alongside Supabase)
- shadcn/ui components in `src/components/ui/`

## Path Aliases
`@/*` → `./src/*`

## Database

### Supabase (Primary)
Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
Migrations in `supabase/migrations/`. Backup scripts in `supabase/backup-db.sh`.

### Local PostgreSQL (Development)
- Host: `localhost:5432`
- Database: `app_dev`, User: `dev`, Password: `dev`
- Extensions: `uuid-ossp`, `pgcrypto`

## Styling
- Dark mode via `[data-pc-theme="dark"]` class selector
- Custom typography classes: `f-h1` through `f-h6`
- Custom spacing tokens: `sidebar-width`, `header-height`
- Tenant-driven color theming at runtime
