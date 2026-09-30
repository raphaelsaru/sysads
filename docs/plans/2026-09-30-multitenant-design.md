# Multitenant por empresa — Design

Data: 2026-09-30

## Objetivo
Levar o CRM a produção para outros clientes. Hierarquia: **superadmin** → **dono de empresa (owner)** → **usuário**. Todos os usuários atuais pertencem à empresa Prizely.

## Decisões
- Isolamento via **RLS no banco** (não filtro na aplicação).
- Visibilidade: usuário vê só os próprios leads; owner vê todos da empresa; superadmin vê a empresa que selecionou (seletor) e cria leads normalmente nela.
- Superadmin pode ser dono de várias empresas.
- Slots: contam só usuários **ativos**, dono incluso. Desativar libera slot.
- Desativado (usuário ou empresa): continua no banco, some do CRM, login bloqueado com aviso.
- Leads de usuário desativado continuam visíveis/editáveis pelo owner.
- Owner não pode se desativar.
- Sem signup público: toda conta nasce de convite por email.
- Nome da empresa: só superadmin edita. Owner edita só cor primária + usuários.
- Branding: só cor primária. Logo fica para depois.
- Convite: template "Invite user" do Supabase em pt-BR com nome da empresa.
- Tenants órfãos existentes (9): manter, decisão futura.

## Estado atual (banco vivo, 2026-09-30)
- `tenants` existe: `name`, `max_users`, `is_active`, `branding`, etc.
- `tenant_id` existe em `clientes`, `negociacoes`, `follow_ups`, `user_profiles`, ignorado pelo código.
- 11 usuários: 5 em Prizely (`8096819e-1349-4595-bfab-c998ad340ca7`), 5 `null`, 1 em outro tenant.
- RLS atual por `user_id`; `is_admin()` global vê tudo.
- Projeto Supabase compartilhado com app financeiro (`profiles` ≠ `user_profiles`).
- Migrations em `supabase/migrations/` divergem do banco — conferir `pg_policies`.

## 1. Modelo de dados
- `user_profiles.role`: `superadmin` | `owner` | `user`.
- `user_profiles.is_active boolean not null default true`.
- `user_profiles.active_tenant_id uuid` (superadmin; empresa visitada).
- `tenants.branding` → `{ primary_color }`; `max_users` = slots; `is_active`.
- Trigger `BEFORE INSERT` em `clientes`/`negociacoes`/`follow_ups`: preenche `tenant_id` a partir do usuário (cobre webhooks service role). Superadmin: usa `current_tenant_id()`.
- Trigger de slots: bloqueia criar/ativar usuário se `ativos >= max_users`.
- Trigger de campos privilegiados (existente) estendido: `role`, `tenant_id` só superadmin; `is_active` superadmin ou owner da mesma empresa (não em si mesmo); `active_tenant_id` só o próprio superadmin.
- Trigger em `tenants`: owner não altera `name`, `max_users`, `is_active`.
- `tenant_id NOT NULL` após backfill.

### Migração de dados
1. Backup (`supabase/backup-db.sh`).
2. Todos os 11 usuários → tenant Prizely.
3. Backfill `tenant_id` = Prizely em `clientes`/`negociacoes`/`follow_ups`.
4. Admin atual → `superadmin`; demais → `user`.
5. `max_users` Prizely = nº atual de usuários.

## 2. RLS + auth
Funções `security definer stable`:
- `is_superadmin()`, `current_tenant_id()`, `is_tenant_owner()`. Retornam falso/null se usuário ou empresa inativos.

Policies:
- `clientes`: `tenant_id = current_tenant_id() AND (user_id = auth.uid() OR is_tenant_owner())`.
- `negociacoes`/`follow_ups`: `EXISTS` no cliente.
- `user_profiles`: próprio; mesma empresa se owner; tudo se superadmin.
- `tenants`: própria empresa; superadmin todas.
- `is_admin()` vira alias de `is_superadmin()` até auditoria dos usos restantes.

App:
- `middleware.ts`: usuário/empresa inativo → `/auth/desativado` + signOut.
- Remover `/auth/signup` e links.
- `POST /api/empresa/usuarios`: checa slot, `auth.admin.inviteUserByEmail` com metadata `{ tenant_id, full_name, company_name }`.
- `handle_new_user()`: lê `tenant_id` do metadata; para de criar tenant.
- `/auth/callback` → tela de definir senha para convites.
- Template Invite Supabase em pt-BR com `{{ .Data.company_name }}`.
- Auditar webhooks (WAHA, Instagram, Google Calendar) que gravam com service role.

## 3. Telas
- **`/admin/empresas`** (superadmin): lista (empresa, dono, ativos/slots, status); criar empresa (nome, slots, promover usuário ou convidar dono); detalhe: nome, slots, ativar/desativar empresa, usuários com toggle, trocar dono. Slots < ativos → erro.
- **Seletor de empresa** (superadmin): dropdown no header/sidebar, grava `active_tenant_id`, recarrega. Badge "Visitando: X" quando ≠ empresa própria.
- **`/empresa`** (owner + superadmin): cor primária (picker + preview); usuários (contador de slots, convidar, ativar/desativar, reenviar convite). `/settings/users` → redirect.
- **Tema**: layout injeta `--primary` (HSL) da empresa; dark mode deriva variante clara. Sem cor → padrão Prizely.
- Listas/filtros de responsável: só ativos da empresa atual.

## Verificação
- Script SQL simulando JWT de user/owner/superadmin em empresas distintas, checando contagens.
- Manual: convite, slot cheio, desativar → bloqueio, seletor, cor.

## Fases
1. Migration dados + RLS + triggers.
2. Auth: bloqueio, remover signup, convite.
3. `/empresa` + tema.
4. Painel superadmin + seletor.
