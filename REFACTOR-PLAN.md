# Prizely CRM — Plano de Refatoração

> Diagnóstico: 5/10. Stack moderna (Next.js 16, React 19), lógica funcional, mas multi-tenant acoplado em tudo, clients duplicados, sem validação, build errors suprimidos.

---

## Fase 1 — Limpeza & Remoção Multi-Tenant *(1-2 sessões)*

### 1.1 Remover código multi-tenant
- [ ] Deletar `src/contexts/TenantContext.tsx`
- [ ] Deletar `src/components/ThemeApplier.tsx`
- [ ] Deletar `src/lib/color-utils.ts`
- [ ] Deletar `src/components/onboarding/ColorPicker.tsx`
- [ ] Deletar `src/components/tenant/LogoUploader.tsx`
- [ ] Deletar `src/hooks/useDailyQuote.ts`
- [ ] Deletar `src/app/onboarding/page.tsx`
- [ ] Deletar `src/app/settings/branding/page.tsx`
- [ ] Deletar `src/app/admin/tenants/` (diretório inteiro)
- [ ] Deletar `src/app/api/admin/tenants/` (diretório inteiro)
- [ ] Deletar `src/app/api/admin/tenant-features/route.ts`
- [ ] Deletar `src/app/api/tenant/` (diretório inteiro)
- [ ] Deletar `src/app/api/quote/route.ts`

### 1.2 Simplificar contextos e types
- [ ] Remover tipos Tenant/Onboarding de `src/types/crm.ts`
- [ ] Simplificar `UserRole` para `'admin' | 'user'`
- [ ] Remover `tenant_id` e `tenantId` dos tipos `Cliente`, `FollowUp`, `UserProfile`
- [ ] Simplificar `AuthContext` — remover fetch de tenant, remover campo `tenant` do UserProfile
- [ ] Remover `AdminContext` (impersonation = multi-tenant feature)
- [ ] Remover `AdminProvider` do `layout.tsx`

### 1.3 Simplificar middleware
- [ ] Remover tenant/onboarding checks do `middleware.ts`
- [ ] Simplificar roles check (`admin`/`user` apenas)
- [ ] Fix bug CORS: `origin.includes('prizely.com.br')` → match exato

### 1.4 Limpar referências em componentes
- [ ] `src/app/page.tsx` — remover `useAdmin`, `useDailyQuote`, impersonation
- [ ] `src/app/clientes/page.tsx` — remover referências admin
- [ ] `src/app/dashboard/page.tsx` — remover referências admin
- [ ] `src/components/layout/Header.tsx` — remover tenant branding/links
- [ ] `src/components/layout/MainLayout.tsx` — remover tenant refs
- [ ] `src/hooks/useClientes.ts` — remover `impersonatedUserId` param e tenant_id filters
- [ ] `src/lib/auth-helpers.ts` — simplificar roles

### 1.5 Limpar dead code e deps
- [ ] Deletar `src/stories/` (storybook morto)
- [ ] Deletar `src/lib/supabase.ts` (legado, sem importadores)
- [ ] Deletar `src/lib/db.ts` (pg direto, sem importadores)
- [ ] Deletar `src/app/emite-visuals/route.ts` (se não usado)
- [ ] Remover deps: `pg`, `@types/pg` do package.json
- [ ] Remover storybook deps se não usar: `storybook`, `@storybook/*`, `@chromatic-com/*`, `@vitest/*`, `playwright`

### 1.6 Fix build
- [ ] Remover `ignoreBuildErrors: true` do next.config.ts
- [ ] Fix todos os erros TS que surgirem
- [ ] Testar `pnpm build` com sucesso

---

## Fase 2 — Infra de Qualidade *(1-2 sessões)*

### 2.1 API middleware & formato padrão
- [ ] Extrair auth check em helper reutilizável (eliminar duplicação ~42x)
- [ ] Criar formato padrão de resposta: `{ data, error, meta }`
- [ ] Fix CORS em `/api/followups/route.ts` (allowCredentials bug)

### 2.2 Validação com Zod
- [ ] Instalar `zod`
- [ ] Criar schemas para: Cliente, FollowUp, UserProfile
- [ ] Validar input em todas as API routes

### 2.3 Paginação
- [ ] Adicionar paginação no backend (clientes, followups)
- [ ] Implementar cursor-based ou offset pagination
- [ ] Frontend: infinite scroll ou pagination controls

### 2.4 Database
- [ ] Criar migration removendo `tenant_id` de todas tabelas
- [ ] Criar migration removendo tabela `tenants`
- [ ] Simplificar RLS policies (sem tenant filter)
- [ ] Adicionar indexes compostos: `(origem, created_at)`, `(resultado, created_at)`
- [ ] Criar enums PostgreSQL para `origem` e `resultado`
- [ ] Adicionar `updated_at` triggers automáticos
- [ ] Considerar soft delete (`deleted_at`)

---

## Fase 3 — UX Profissional *(2-3 sessões)*

### 3.1 Data fetching
- [ ] Instalar TanStack Query
- [ ] Migrar hooks para usar React Query (cache, background refetch, optimistic updates)

### 3.2 Feedback & estados
- [ ] Instalar `sonner` (toast notifications)
- [ ] Substituir todos `alert()` por toasts
- [ ] Skeleton loaders em todas páginas
- [ ] Empty states com ilustrações e CTAs
- [ ] Error boundaries por page

### 3.3 Navegação & filtros
- [ ] Filtros persistidos na URL (searchParams)
- [ ] Breadcrumbs
- [ ] Dark mode toggle para usuário

### 3.4 Tabela profissional
- [ ] Export CSV/Excel
- [ ] Column sorting persistido
- [ ] Mobile card view (já parcial)
- [ ] Bulk status update (não só delete)

---

## Fase 4 — Features Novas *(ongoing)*

### 4.1 Alta prioridade
- [ ] Kanban view (pipeline visual: Orçamento → Venda → Pago)
- [ ] Command palette (Cmd+K) — busca global + ações rápidas
- [ ] Activity log / audit trail
- [ ] Templates de follow-up
- [ ] Notificações push/email para follow-ups

### 4.2 Média prioridade
- [ ] Tags/labels nos clientes
- [ ] Custom fields
- [ ] Dashboard customizável
- [ ] Relatórios avançados com export PDF
- [ ] Busca fuzzy global

### 4.3 Integrações
- [ ] WhatsApp Business API
- [ ] Instagram DM
- [ ] Google Calendar (agendamentos)
- [ ] Webhook system para automações

---

## Status

| Fase | Status | Início | Fim |
|------|--------|--------|-----|
| 1 — Limpeza | ✅ Concluída | 2026-05-27 | 2026-05-27 |
| 2 — Infra | ⬜ Pendente | — | — |
| 3 — UX | ⬜ Pendente | — | — |
| 4 — Features | ⬜ Pendente | — | — |
