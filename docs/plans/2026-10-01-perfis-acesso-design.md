# Perfis de acesso e navegação — design

Data: 2026-10-01

## Objetivo
Controle de acesso por perfil (superadmin, dono, gestor, vendedor, artista), navegação adaptada ao perfil, home orientada a cliente e dono com múltiplas empresas.

## Papéis
- Gestor = gestor de tráfego: vê operação da empresa, cuida de integrações/Meta, não opera leads alheios.
- Enum `user_role` += `gestor`, `vendedor`.
- `admin` = superadmin (nome mantido). `owner` = Dono. `user` = **Artista** (só o label muda; os 11 `user` atuais viram Artista).
- Role continua global em `user_profiles.role` (dono é dono em todas as empresas vinculadas).

## Matriz (`src/lib/permissions.ts`)
Fonte única p/ Sidebar, middleware e APIs: `pode(role, area)` e `homePath(role)`.

| área | admin | owner | gestor | vendedor | artista |
|---|---|---|---|---|---|
| leads / clientes / agenda | ✓ | ✓ | ✓ | ✓ | ✓ |
| painel | ✓ | ✓ | ✓ | – | ✓ (só próprias métricas) |
| integrações (empresa) | ✓ | ✓ | ✓ | – | – |
| card Meta CAPI | ✓ | – | ✓ | – | – |
| convidar/gerenciar usuários | ✓ | ✓ | – | – | – |
| minha empresa | ✓ | ✓ | – | – | – |
| visualizar como | ✓ | ✓ | ✓ | – | – |
| admin global | ✓ | – | – | – | – |
| ver dados | empresa | empresa | empresa | próprios | próprios |
| criar/editar/excluir dados | empresa | empresa | só próprios (não cria p/ outro) | próprios | próprios |
| home | /admin/empresas | /equipe | /leads | /leads | /clientes |

Superadmin visitando outra empresa continua vendo menus de owner (regra atual).

## Banco
- `ve_empresa_toda()` = role ∈ (admin, owner, gestor) e tenant efetivo não nulo. Policies **SELECT** de clientes/negociacoes/follow_ups e RPC do dashboard passam a usar ela.
- `edita_empresa_toda()` = role ∈ (admin, owner). Policies **UPDATE/DELETE** usam ela (gestor só edita os próprios).
- `is_tenant_owner()` segue p/ gestão (convites, cor, usuários).
- Tabela `tenant_owners(tenant_id, user_id, created_at, pk(tenant_id,user_id))`, FKs `ON DELETE RESTRICT`/cascade no user: empresas extras do dono.
  - `effective_tenant_id(uid)`: aceita `active_tenant_id` se superadmin **ou** owner com vínculo em `tenant_owners`.
  - `acesso_crm()`/`is_tenant_owner()` respeitam o vínculo (empresa visitada ativa).
  - Trigger de slots ignora vínculos extras (conta só `tenant_id` primário).
- Superadmin vincula/desvincula dono existente em `/admin/empresas/[id]`.

## Navegação
- Tabela de leads sai de `/` → `/leads` (`/leads/[id]` = detalhe existente).
- `/` redireciona p/ `homePath(role)` no middleware.
- `/clientes` vira grid de cards: nome, status, valor, última interação, próximo agendamento. Clique → `/leads/[id]`. Escopo pelo RLS.
- Middleware: rota fora da matriz → home do perfil. APIs (`dashboard`, `empresa/meta`, `settings/integrations`, etc.) checam `pode()` também.
- `EmpresaSwitcher`: aparece p/ owner com >1 empresa (lista via `tenant_owners`); endpoint de troca generalizado (superadmin ou owner vinculado).
- WhatsApp/Instagram pessoais → `/conta/conexoes`, item no menu da conta (todos os perfis). `/settings/integrations` = integrações da empresa; card Meta só gestor/superadmin (owner vê a página sem o card).
- Painel do artista: mesmo `/dashboard`, dados restritos aos próprios (RLS/RPC), sem seletor de usuário.
- Convite em `/empresa`: owner escolhe papel (gestor / vendedor / artista).

## Testes
- Vitest: matriz `permissions.ts` (`pode`, `homePath`).
- `supabase/tests/multitenant_rls.sql`: gestor vê empresa mas não edita lead alheio; vendedor/artista só próprios; dono em 2 empresas troca e não vaza; dono extra não ocupa slot.

## Ajuste 2026-10-01: home do dono = equipe
- `/equipe` (área `equipe`): um card por artista ativo (role `user`) com leads, vendas, valor vendido e conversão (vendas/leads) do mês vigente — RPC `dashboard_equipe(p_inicio, p_fim)` (security invoker, mesmo critério do `dashboard_resumo`).
- Clique no card: "Visualizar como" o artista + abre `/dashboard`.
- `/clientes` continua no menu.
