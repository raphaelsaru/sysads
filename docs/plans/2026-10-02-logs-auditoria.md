# Logs de auditoria (dono) — design + plano

Data: 2026-10-02. Decisões do usuário: só o dono (e superadmin) vê; retenção 12 meses; ações automáticas (webhook, cron) ficam de fora.

## Design

**Tabela `audit_log`** (append-only)
`id bigint identity`, `tenant_id uuid` (FK restrict), `ator_id uuid`, `ator_nome text` (snapshot), `tabela text`, `operacao text` (`INSERT|UPDATE|DELETE`), `registro_id uuid`, `rotulo text` (ex. nome do cliente), `mudancas jsonb` (`{campo: [antes, depois]}`; no INSERT/DELETE só campos relevantes), `created_at timestamptz`.
Índice `(tenant_id, created_at desc)` e `(tenant_id, ator_id, created_at desc)`.
RLS: SELECT só `tenant_id = current_tenant_id() and is_tenant_owner()` (dono/superadmin). Sem INSERT/UPDATE/DELETE p/ ninguém (só o gatilho, security definer).

**Quem fez (ator)**
- Escrita pelo navegador: `auth.uid()`.
- Rotas de servidor (service role) que agem em nome do usuário: cliente admin envia header `x-prizely-ator: <userId>`; gatilho lê `current_setting('request.headers', true)::json->>'x-prizely-ator'`. `createAdminClient({ atorId })`.
- Sem `auth.uid()` e sem header (webhook WAHA, cron Meta, scripts) = automático → **não registra**.

**Gatilho genérico `registrar_auditoria()`** (security definer) em:
| tabela | rótulo | campos auditados (ignora `updated_at`, `updated_by`, `tenant_id`, colunas geradas) |
|---|---|---|
| clientes | nome | nome, whatsapp_instagram, email, origem, observacao, categoria, user_id |
| negociacoes | nome do cliente | resultado, valor_fechado, pagou_sinal, valor_sinal, venda_paga, datas, qualidade, observacao |
| follow_ups | nome do cliente | conteúdo/data |
| user_profiles | full_name | role, is_active, full_name |
| tenants | name | name, branding, max_users, is_active |
| vendedor_artistas | vendedor → artista | insert/delete |
| tenant_owners | dono | insert/delete |
UPDATE sem mudança em campo auditado → não registra. Campos por tabela definidos via `TG_ARGV` (lista) — um só gatilho.

**Retenção**: pg_cron diário apaga `created_at < now() - interval '12 months'`.

**LGPD**: logs contêm nome/telefone; somem em 12 meses. Exclusão de cliente a pedido: rota/rotina existente deve também anonimizar `audit_log` (`rotulo`/`mudancas`) do `registro_id` — tarefa própria abaixo.

**Tela `/logs`** (área `logs` = admin/owner; item "Logs" no menu)
Lista paginada (50 por vez, cursor por `created_at,id`), filtros: usuário, tipo (leads, negociações, follow-ups, equipe, empresa), período. Texto humano via função pura `descreverEvento()`:
"Ana alterou o valor da negociação de João Silva: R$ 500 → R$ 800 · 02/10 14:32". Clique no lead abre `/leads/[id]` (se ainda existir).

**Impacto**: ~2–5 MB/mês no volume atual; <1 ms por escrita; nada na Vercel além da tela.

## Plano

1. **permissions**: área `logs` (admin, owner); rota `/logs`; testes. Commit.
2. **Migration `audit_log`**: tabela, índices, RLS, função `registrar_auditoria()` + gatilhos nas 7 tabelas, cron de retenção. Teste SQL `supabase/tests/audit_log.sql`: dono vê log da própria empresa; gestor/vendedor/artista não veem; outra empresa não vê; escrita sem ator (service role sem header) não gera log; com header gera com ator certo; UPDATE só de `updated_at` não gera. **Aplicar em produção só com aval.** Commit.
3. **Ator nas rotas de servidor**: `createAdminClient({ atorId })` (header global); passar `caller.userId` nas rotas de gestão (`empresa/usuarios*`, `empresa/*/artistas`, `admin/empresas*`, `admin/empresa-ativa` não — não é dado auditado, `empresa` PATCH, `empresa/meta`). Webhook/cron continuam sem ator. Commit.
4. **`descreverEvento()`** (TDD, `src/lib/auditoria.ts`): rótulos de campo em pt-BR, formatação de moeda/data/booleano, papéis via `roleLabel`. Commit.
5. **API `GET /api/empresa/logs`** (RLS via cliente do usuário; filtros + cursor) e **tela `/logs`** (cards/lista, filtros, "carregar mais"). Commit.
6. **LGPD**: ao excluir cliente a pedido (fluxo de exclusão existente), anonimizar logs do registro. Commit.
7. Docs (CLAUDE.md) + build/test/lint. Push só quando pedido.
