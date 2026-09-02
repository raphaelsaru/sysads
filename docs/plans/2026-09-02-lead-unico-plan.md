# Lead único — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Um lead = um cadastro único em `clientes` (dedup por telefone/instagram normalizado), com histórico de negociações (orçamentos/vendas) numa tabela nova `negociacoes` e uma página `/leads/[id]` mostrando LTV e timeline.

**Architecture:** Migration SQL faz a separação pessoa/negociação + merge de duplicados existentes + constraints únicas + função `find_or_create_cliente`. Camada de normalização compartilhada (SQL function + util TS). `useClientes.ts` (fala direto com Supabase) e as API routes (`/api/clientes/*`, usadas pela extensão Chrome) são reescritas pra usar as duas tabelas. Webhooks WAHA/Instagram trocam `create_lead_dedup` por `find_or_create_cliente`. Dashboard e páginas de listagem passam a ler `negociacoes` pro que hoje é campo de `Cliente`. `ClienteModal`/`ClienteForm` somem; nasce `NegociacaoForm` (extraído do bloco de negociação do `ClienteModal`) usado dentro de `/leads/[id]`.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + `@supabase/ssr` + JS client direto no browser), TypeScript strict, sem test runner (verificação manual).

**Sem testes automatizados** — cada tarefa tem passo de verificação manual (SQL via MCP Supabase, `curl`, ou browser) no lugar de "rode os testes".

---

## Fase 0 — Banco de dados

### Task 0.1: Função de normalização (SQL)

**Files:**
- Create: `supabase/migrations/20260902100000_normalizacao_contato.sql`

**Step 1: Escrever a migration**

```sql
create or replace function public.normalizar_telefone(p_texto text)
returns text
language sql
immutable
as $$
  select case
    when p_texto is null then null
    else nullif(
      case
        -- remove tudo que não é dígito
        when length(regexp_replace(p_texto, '\D', '', 'g')) >= 12
             and left(regexp_replace(p_texto, '\D', '', 'g'), 2) = '55'
        then substring(regexp_replace(p_texto, '\D', '', 'g') from 3)
        else regexp_replace(p_texto, '\D', '', 'g')
      end,
      ''
    )
  end
$$;

create or replace function public.normalizar_instagram(p_texto text)
returns text
language sql
immutable
as $$
  select nullif(lower((regexp_match(p_texto, '@?([\w.]+)'))[1]), '')
$$;
```

**Step 2: Aplicar via MCP Supabase**

Use `mcp__supabase__apply_migration` com o nome `normalizacao_contato` e o SQL acima.

**Step 3: Verificar manualmente**

Via `mcp__supabase__execute_sql`:
```sql
select normalizar_telefone('(11) 99999-8888'), normalizar_telefone('+55 11 99999-8888'),
       normalizar_instagram('@Fulano.Silva'), normalizar_instagram('fulano_2');
```
Esperado: `'11999998888'` (nas duas primeiras), `'fulano.silva'`, `'fulano_2'`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260902100000_normalizacao_contato.sql
git commit -m "feat: adiciona functions de normalizacao de telefone/instagram"
```

---

### Task 0.2: Colunas normalizadas em `clientes` (sem constraint ainda)

**Files:**
- Create: `supabase/migrations/20260902100100_add_colunas_normalizadas.sql`

**Step 1: Migration**

```sql
alter table public.clientes
  add column if not exists telefone_normalizado text
    generated always as (public.normalizar_telefone(whatsapp_instagram)) stored,
  add column if not exists instagram_normalizado text
    generated always as (public.normalizar_instagram(whatsapp_instagram)) stored;
```

**Step 2: Aplicar e verificar**

`mcp__supabase__apply_migration`, depois:
```sql
select whatsapp_instagram, telefone_normalizado, instagram_normalizado
from public.clientes limit 20;
```
Confere visualmente se a extração faz sentido pros dados reais (whatsapp texto livre pode ter formatos inesperados — ok se ficar `null` nos dois quando não reconhece).

**Step 3: Commit**

```bash
git add supabase/migrations/20260902100100_add_colunas_normalizadas.sql
git commit -m "feat: adiciona colunas geradas telefone/instagram normalizado em clientes"
```

---

### Task 0.3: Tabela `negociacoes`

**Files:**
- Create: `supabase/migrations/20260902100200_create_negociacoes.sql`

**Step 1: Migration**

```sql
create table public.negociacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001',
  data_contato date not null,
  orcamento_enviado boolean not null default false,
  resultado text not null default 'Orçamento em Processo',
  qualidade_contato text,
  nao_respondeu boolean not null default false,
  valor_fechado numeric,
  pagou_sinal boolean not null default false,
  valor_sinal numeric,
  data_pagamento_sinal date,
  venda_paga boolean not null default false,
  data_pagamento_venda date,
  data_lembrete_chamada date,
  observacao text,
  data_mes_venda date generated always as (
    coalesce(data_pagamento_sinal, data_contato)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index negociacoes_cliente_id_idx on public.negociacoes(cliente_id);
create index negociacoes_data_mes_venda_idx on public.negociacoes(data_mes_venda);

alter table public.negociacoes enable row level security;

create policy "negociacoes_select" on public.negociacoes for select
  using (exists (select 1 from public.clientes c where c.id = cliente_id and (c.user_id = auth.uid() or public.is_admin())));

create policy "negociacoes_insert" on public.negociacoes for insert
  with check (exists (select 1 from public.clientes c where c.id = cliente_id and (c.user_id = auth.uid() or public.is_admin())));

create policy "negociacoes_update" on public.negociacoes for update
  using (exists (select 1 from public.clientes c where c.id = cliente_id and (c.user_id = auth.uid() or public.is_admin())));

create policy "negociacoes_delete" on public.negociacoes for delete
  using (exists (select 1 from public.clientes c where c.id = cliente_id and (c.user_id = auth.uid() or public.is_admin())));
```

(RLS espelha o padrão de `follow_ups`, que já usa EXISTS join em `clientes` — ver inventário seção 1.)

**Step 2: Aplicar via MCP e verificar**

```sql
select column_name, data_type from information_schema.columns where table_name = 'negociacoes' order by ordinal_position;
```
Confere as colunas batem com a lista acima.

**Step 3: Commit**

```bash
git add supabase/migrations/20260902100200_create_negociacoes.sql
git commit -m "feat: cria tabela negociacoes"
```

---

### Task 0.4: Migração de dados — cada linha de `clientes` vira uma negociação

Antes do merge de duplicados (Task 0.5), toda linha atual de `clientes` precisa
virar uma negociação (senão perdemos o histórico ao limpar os campos de
`clientes` na Task 0.6).

**Files:**
- Create: `supabase/migrations/20260902100300_backfill_negociacoes.sql`

**Step 1: Migration**

```sql
insert into public.negociacoes (
  cliente_id, tenant_id, data_contato, orcamento_enviado, resultado,
  qualidade_contato, nao_respondeu, valor_fechado, pagou_sinal, valor_sinal,
  data_pagamento_sinal, venda_paga, data_pagamento_venda, data_lembrete_chamada,
  observacao, created_at, updated_at, created_by, updated_by
)
select
  id, tenant_id, data_contato, orcamento_enviado, resultado,
  qualidade_contato, nao_respondeu, valor_fechado, pagou_sinal, valor_sinal,
  data_pagamento_sinal, venda_paga, data_pagamento_venda, data_lembrete_chamada,
  observacao, created_at, updated_at, created_by, updated_by
from public.clientes;
```

**Step 2: Aplicar e verificar**

```sql
select (select count(*) from public.clientes) as clientes,
       (select count(*) from public.negociacoes) as negociacoes;
```
Esperado: os dois números iguais (4174 hoje, conferir count atual antes de aplicar).

**Step 3: Commit**

```bash
git add supabase/migrations/20260902100300_backfill_negociacoes.sql
git commit -m "feat: backfill negociacoes a partir de clientes existentes"
```

---

### Task 0.5: Merge de duplicados

**Files:**
- Create: `supabase/migrations/20260902100400_merge_duplicados.sql`

**Step 1: Migration**

```sql
do $$
declare
  v_clusters int := 0;
  v_linhas int := 0;
begin
  -- clusters por telefone_normalizado
  with clusters as (
    select telefone_normalizado, array_agg(id order by created_at) as ids
    from public.clientes
    where telefone_normalizado is not null
    group by telefone_normalizado
    having count(*) > 1
  ),
  merges as (
    select ids[1] as canonico, unnest(ids[2:]) as duplicado
    from clusters
  ),
  reponta_followups as (
    update public.follow_ups f
    set cliente_id = m.canonico
    from merges m
    where f.cliente_id = m.duplicado
    returning 1
  ),
  reponta_negociacoes as (
    update public.negociacoes n
    set cliente_id = m.canonico
    from merges m
    where n.cliente_id = m.duplicado
    returning 1
  ),
  apaga as (
    delete from public.clientes c
    using merges m
    where c.id = m.duplicado
    returning 1
  )
  select count(*), count(distinct canonico) from merges into v_linhas, v_clusters;

  raise notice 'telefone: % clusters, % linhas mescladas', v_clusters, v_linhas;

  -- repete pra instagram_normalizado (clusters remanescentes após o merge por telefone)
  with clusters as (
    select instagram_normalizado, array_agg(id order by created_at) as ids
    from public.clientes
    where instagram_normalizado is not null
    group by instagram_normalizado
    having count(*) > 1
  ),
  merges as (
    select ids[1] as canonico, unnest(ids[2:]) as duplicado
    from clusters
  ),
  reponta_followups as (
    update public.follow_ups f
    set cliente_id = m.canonico
    from merges m
    where f.cliente_id = m.duplicado
    returning 1
  ),
  reponta_negociacoes as (
    update public.negociacoes n
    set cliente_id = m.canonico
    from merges m
    where n.cliente_id = m.duplicado
    returning 1
  ),
  apaga as (
    delete from public.clientes c
    using merges m
    where c.id = m.duplicado
    returning 1
  )
  select count(*), count(distinct canonico) from merges into v_linhas, v_clusters;

  raise notice 'instagram: % clusters, % linhas mescladas', v_clusters, v_linhas;
end $$;
```

Nota de execução (achado no code review após a implementação real): as três CTEs graváveis (`reponta_followups`, `reponta_negociacoes`, `apaga`) sendo irmãs num único `WITH`, sem dependência de dados entre si, dependem de ordem de execução que o Postgres não garante formalmente — e `negociacoes`/`follow_ups` têm `ON DELETE CASCADE` pra `clientes`, então se `apaga` rodasse antes das duas UPDATEs, o cascade apagaria os filhos silenciosamente antes do reponte. Funcionou (zero órfãos, conservação exata, verificado independentemente), mas é sorte de ordem declarativa, não garantia. Pra qualquer migration futura no mesmo padrão (reponta-depois-apaga com FK CASCADE), preferir statements sequenciais explícitos (UPDATE, UPDATE, DELETE em três comandos separados, não CTEs irmãs) ou um `assert`/`raise exception` antes do DELETE confirmando que não sobrou nenhuma referência nas tabelas filhas.

Nota: como `telefone_normalizado`/`instagram_normalizado` são colunas geradas
a partir de `whatsapp_instagram`, o merge por telefone já elimina duplicados
que também batem por instagram (mesma pessoa, mesma linha de origem) — a
segunda passada só pega clusters que só batiam por instagram (telefone nulo
ou diferente).

**Step 2: Antes de aplicar — rodar um SELECT de auditoria primeiro (dry run)**

Via `mcp__supabase__execute_sql`, ANTES de aplicar a migration:
```sql
select telefone_normalizado, count(*), array_agg(nome) 
from public.clientes where telefone_normalizado is not null
group by telefone_normalizado having count(*) > 1
order by count(*) desc limit 20;
```
Revisar visualmente se os agrupamentos fazem sentido (nomes parecidos/relacionados). Se aparecer algo estranho (ex.: número genérico tipo "0000000000" agrupando gente não relacionada), ajustar a normalização antes de prosseguir — reportar ao usuário antes de aplicar o merge.

**Step 3: Aplicar via MCP Supabase**

Ler os `raise notice` no resultado da aplicação — reportar os números pro usuário.

**Step 4: Verificar**

```sql
select count(*) from public.clientes;
select count(*) from public.clientes where telefone_normalizado in (
  select telefone_normalizado from public.clientes where telefone_normalizado is not null
  group by telefone_normalizado having count(*) > 1
);
```
Segunda query deve retornar 0.

**Step 5: Commit**

```bash
git add supabase/migrations/20260902100400_merge_duplicados.sql
git commit -m "feat: mescla clientes duplicados por telefone/instagram normalizado"
```

---

### Task 0.6: Constraints únicas + limpa campos de negociação de `clientes`

**Files:**
- Create: `supabase/migrations/20260902100500_constraints_e_limpeza.sql`

**Step 1: Migration**

```sql
create unique index clientes_telefone_normalizado_uidx
  on public.clientes(user_id, telefone_normalizado) where telefone_normalizado is not null;

create unique index clientes_instagram_normalizado_uidx
  on public.clientes(user_id, instagram_normalizado) where instagram_normalizado is not null;

alter table public.clientes
  drop column orcamento_enviado,
  drop column resultado,
  drop column qualidade_contato,
  drop column nao_respondeu,
  drop column valor_fechado,
  drop column pagou_sinal,
  drop column valor_sinal,
  drop column data_pagamento_sinal,
  drop column venda_paga,
  drop column data_pagamento_venda,
  drop column data_lembrete_chamada,
  drop column data_mes_venda;
```

**Step 2: Aplicar via MCP e verificar**

```sql
select column_name from information_schema.columns where table_name = 'clientes' order by ordinal_position;
```
Confere que só sobrou: id, user_id, data_contato, nome, whatsapp_instagram, origem, tenant_id, created_at, updated_at, created_by, updated_by, categoria, observacao, telefone_normalizado, instagram_normalizado.

Tentar inserir duplicado pra confirmar a constraint:
```sql
insert into public.clientes (user_id, data_contato, nome, whatsapp_instagram, origem)
select user_id, current_date, 'Teste Dup', whatsapp_instagram, origem
from public.clientes where telefone_normalizado is not null limit 1;
```
Esperado: erro de unique violation. Depois reverter (não commitar essa linha de teste — se inserir sem querer, `delete from clientes where nome = 'Teste Dup'`).

**Step 3: Commit**

```bash
git add supabase/migrations/20260902100500_constraints_e_limpeza.sql
git commit -m "feat: constraints unicas de contato + remove campos de negociacao de clientes"
```

**Checkpoint:** neste ponto o schema já reflete o design final. As próximas fases atualizam o código pra usar o novo shape. Rodar `pnpm build` no worktree pra confirmar que o TS (que ainda referencia campos antigos) começa a quebrar como esperado — isso guia as próximas tarefas.

---

### Task 0.7: Função `find_or_create_cliente` (substitui `create_lead_dedup`)

**Files:**
- Create: `supabase/migrations/20260902100600_find_or_create_cliente.sql`

**Step 1: Migration**

```sql
create or replace function public.find_or_create_cliente(
  p_user_id uuid,
  p_data_contato date,
  p_nome text,
  p_identificador text,
  p_origem text,
  p_created_by uuid
) returns table(id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tel text := public.normalizar_telefone(p_identificador);
  v_insta text := public.normalizar_instagram(p_identificador);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || '|' || coalesce(v_tel, v_insta, p_identificador), 0));

  select c.id into v_id from clientes c
  where c.user_id = p_user_id
    and ((v_tel is not null and c.telefone_normalizado = v_tel)
         or (v_insta is not null and c.instagram_normalizado = v_insta))
  order by c.created_at
  limit 1;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem, created_by, updated_by)
  values (p_user_id, p_data_contato, p_nome, p_identificador, p_origem::origem_tipo, p_created_by, p_created_by)
  returning clientes.id into v_id;

  return query select v_id, true;
end;
$$;

grant execute on function public.find_or_create_cliente(uuid, date, text, text, text, uuid) to service_role;

-- create_lead_dedup fica obsoleta (removida na Task 5.x depois de migrar os call sites)
```

**Step 2: Aplicar via MCP e verificar**

```sql
select * from public.find_or_create_cliente(
  (select user_id from clientes limit 1), current_date, 'Teste FOC', '11988887777', 'Instagram',
  (select user_id from clientes limit 1)
);
-- roda de novo com o mesmo identificador — created deve vir false na 2a vez
```
Depois: `delete from clientes where nome = 'Teste FOC';`

**Step 3: Commit**

```bash
git add supabase/migrations/20260902100600_find_or_create_cliente.sql
git commit -m "feat: adiciona find_or_create_cliente, substitui create_lead_dedup"
```

---

## Fase 1 — Tipos TypeScript

### Task 1.1: Split `Cliente` / `Negociacao` em `crm.ts`

**Files:**
- Modify: `src/types/crm.ts:25-75`

**Step 1: Reescrever os tipos**

```typescript
export interface Cliente {
  id?: string;
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: 'Indicação' | 'Orgânico / Perfil' | 'Anúncio' | 'Cliente antigo' | 'Anúncio Promoção' | 'Anúncio Geral' | 'Instagram' | 'Google' | 'Outro' | 'WhatsApp' | 'Site';
  observacao?: string;
  createdAt?: string;
  created_by?: string;
  updated_by?: string;
  categoria?: string;
  userId?: string;
  // agregados calculados na leitura (join com negociacoes), não colunas de clientes
  totalFollowUps?: number;
  negociacoes?: Negociacao[];
  ltv?: number;
  ultimaNegociacao?: Negociacao;
}

export interface Negociacao {
  id: string;
  clienteId: string;
  dataContato: string;
  orcamentoEnviado: 'Sim' | 'Não';
  resultado: 'Venda' | 'Orçamento em Processo' | 'Não Venda';
  qualidadeContato: 'Bom' | 'Regular' | 'Ruim';
  naoRespondeu?: boolean;
  valorFechado?: string;
  valorFechadoNumero?: number | null;
  observacao?: string;
  pagouSinal?: boolean;
  valorSinal?: string;
  valorSinalNumero?: number | null;
  dataPagamentoSinal?: string;
  vendaPaga?: boolean;
  dataPagamentoVenda?: string;
  dataLembreteChamada?: string;
  createdAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface NovoCliente {
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: Cliente['origem'];
  observacao?: string;
  categoria?: string;
}

export interface NovaNegociacao {
  clienteId: string;
  dataContato: string;
  orcamentoEnviado: Negociacao['orcamentoEnviado'];
  resultado: Negociacao['resultado'];
  qualidadeContato: Negociacao['qualidadeContato'];
  naoRespondeu?: boolean;
  valorFechado?: string;
  observacao?: string;
  pagouSinal?: boolean;
  valorSinal?: string;
  dataPagamentoSinal?: string;
  vendaPaga?: boolean;
  dataPagamentoVenda?: string;
  dataLembreteChamada?: string;
}
```

Atualizar `origem` do enum comparando com os valores reais do banco
(inventário seção 1) — usar exatamente essa lista.

**Step 2: Verificar**

`pnpm tsc --noEmit 2>&1 | head -50` — vai gerar dezenas de erros nos
arquivos que usam os campos antigos de `Cliente`. Isso é esperado; cada erro
mapeia pra uma tarefa das próximas fases. Não corrigir agora, só confirmar
que o comando roda e lista os arquivos afetados (guarda essa lista pra
conferir no final que zerou).

**Step 3: Commit**

```bash
git add src/types/crm.ts
git commit -m "feat: separa tipos Cliente e Negociacao"
```

---

## Fase 2 — Normalização compartilhada (TS)

### Task 2.1: Util de normalização

**Files:**
- Create: `src/lib/normalizacao.ts`

**Step 1: Implementar**

```typescript
export function normalizarTelefone(texto: string | null | undefined): string | null {
  if (!texto) return null
  const digitos = texto.replace(/\D/g, '')
  if (digitos.length >= 12 && digitos.startsWith('55')) {
    return digitos.slice(2) || null
  }
  return digitos || null
}

export function normalizarInstagram(texto: string | null | undefined): string | null {
  if (!texto) return null
  const match = texto.match(/@?([\w.]+)/)
  return match ? match[1].toLowerCase() : null
}
```

Espelha exatamente as functions SQL da Task 0.1 (mesma regra) — usado no
client (OCR import, validação de form antes de submeter) onde não dá pra
chamar o banco.

**Step 2: Verificar**

Criar um arquivo temporário de scratch (`/private/tmp/.../check.ts` no
scratchpad) rodando com `npx tsx` ou similar, comparando com os mesmos casos
da Task 0.1 Step 3. Não precisa virar teste permanente (sem test runner) —
só confirmar visualmente e apagar o scratch.

**Step 3: Commit**

```bash
git add src/lib/normalizacao.ts
git commit -m "feat: util TS de normalizacao de telefone/instagram"
```

---

## Fase 3 — `useClientes.ts`

Ver inventário seção 4: hoje fala direto com Supabase (`clientesTable()`,
linha 16). Vira dois hooks: `useClientes` (só pessoa) e `useNegociacoes`
(CRUD de negociação por `clienteId`), ambos direto Supabase (mantém o padrão
atual, não introduz API route nova pro app principal).

### Task 3.1: `useNegociacoes.ts` novo

**Files:**
- Create: `src/hooks/useNegociacoes.ts`
- Reference: `src/hooks/useClientes.ts:407-591` (padrão de `adicionarCliente`/`editarCliente` a seguir)

**Step 1: Implementar** `listarNegociacoes(clienteId)`, `adicionarNegociacao(nova: NovaNegociacao)`, `editarNegociacao(id, payload)`, `excluirNegociacao(id)` — mesmo padrão de loading/error state que `useClientes.ts` já usa, mas operando em `supabase.from('negociacoes')`. Mapeamento de campos camelCase↔snake_case espelha o que `adicionarCliente` fazia nas linhas 440-454 pros campos que agora são de negociação.

**Step 2: Verificar manualmente**

Criar uma página de teste temporária ou usar o browser console em `/` (após
Fase 6 dar um form básico) — ou testar via `curl`/MCP Supabase direto
inserindo uma linha e conferindo que o hook lê de volta certo. Documentar no
commit que a verificação plena só é possível depois da Fase 6 (UI); por ora
confirmar só que compila e a query monta certo (`console.log` do payload).

**Step 3: Commit**

```bash
git add src/hooks/useNegociacoes.ts
git commit -m "feat: adiciona hook useNegociacoes"
```

---

### Task 3.2: Reescrever `useClientes.ts` — remover campos de negociação

**Files:**
- Modify: `src/hooks/useClientes.ts:407-591` (`adicionarCliente`, `editarCliente`)
- Modify: `src/hooks/useClientes.ts:206` (`carregarEstatisticas` — provavelmente lê `resultado`/`valorFechado`, precisa virar query em `negociacoes`; abrir o arquivo nessa linha pra confirmar o shape antes de reescrever)
- Modify: `src/hooks/useClientes.ts:299,359` (`carregarClientes`/`carregarMaisClientes` — remove select dos campos removidos, opcionalmente já traz `negociacoes` mais recente via join pra alimentar a coluna da tabela)

**Step 1:** `adicionarCliente` — chama `find_or_create_cliente` via RPC (`supabase.rpc('find_or_create_cliente', {...})`) em vez de INSERT direto; se `created: false`, ainda assim segue pra criar a negociação inicial associada (chamando `useNegociacoes.adicionarNegociacao` com os dados que vieram no form). Se `created: false` E o form era "criar novo" (não "adicionar negociação pra existente"), retornar um erro/aviso específico `{ duplicado: true, clienteId }` pro form mostrar o link (design Fase 2, decisão de bloquear no form manual).

**Step 2:** `editarCliente` — payload passa a ter só campos de pessoa (`ClienteUpdatePayload` reduzido, linha 510-529 atual).

**Step 3:** `carregarClientes`/`carregarMaisClientes` — select troca os campos removidos por um join: `.select('*, negociacoes(resultado, valor_fechado, data_contato, created_at)')` ordenado, ou uma segunda query agregada — decidir com base no volume (4174 clientes) e no que `ClienteTable` precisa (negociação mais recente, decisão já tomada). Usar `.order('created_at', {foreignTable: 'negociacoes', ascending: false}).limit(1, {foreignTable:'negociacoes'})` se a versão do supabase-js suportar, senão RPC dedicada `listar_clientes_com_ultima_negociacao`.

**Step 4: Verificar**

`pnpm tsc --noEmit` — erros relacionados a este arquivo devem zerar. Rodar
`pnpm dev`, abrir `/`, conferir no Network tab que a query pro Supabase
retorna sem erro 400 (mesmo que a UI ainda quebre — isso é Fase 6).

**Step 5: Commit**

```bash
git add src/hooks/useClientes.ts
git commit -m "feat: useClientes usa find_or_create_cliente, remove campos de negociacao"
```

---

## Fase 4 — API routes (`/api/clientes/*`, extensão Chrome)

### Task 4.1: `POST /api/clientes` — separa pessoa/negociação internamente

**Files:**
- Modify: `src/app/api/clientes/route.ts:181-260` (POST handler)

**Step 1:** Trocar o INSERT direto (linhas 206-221) por: chamada RPC
`find_or_create_cliente` (mesmo padrão da Task 3.2) + INSERT em `negociacoes`
com os campos de negociação do payload recebido (payload da extensão não
muda — decisão confirmada). Manter os CORS headers (linhas 162-165, 233-236)
intactos.

**Step 2: Verificar**

```bash
curl -X POST http://localhost:3000/api/clientes \
  -H "Content-Type: application/json" -H "Cookie: <sessão válida>" \
  -d '{"dataContato":"2026-09-02","nome":"Teste API","whatsappInstagram":"11977776666","origem":"Site","orcamentoEnviado":"Não","resultado":"Orçamento em Processo","qualidadeContato":"Bom"}'
```
Rodar duas vezes com o mesmo `whatsappInstagram` — 2ª vez não deve criar
`clientes` novo, mas deve criar uma 2ª linha em `negociacoes` (conferir via
MCP Supabase `select count(*) from negociacoes where cliente_id = '<id>'`).
Depois: apagar os registros de teste.

**Step 3: Commit**

```bash
git add src/app/api/clientes/route.ts
git commit -m "feat: POST /api/clientes usa find_or_create_cliente + cria negociacao"
```

---

### Task 4.2: `GET /api/clientes` e `GET/PATCH /api/clientes/[id]`

**Files:**
- Modify: `src/app/api/clientes/route.ts:144` (GET transform)
- Modify: `src/app/api/clientes/[id]/route.ts:39,85,122`

**Step 1:** GET passa a incluir `negociacoes` (join) e `totalFollowUps` no
retorno (design Fase 4). PATCH aceita só campos de pessoa — se vier campo de
negociação no payload, ignora ou retorna 400 (decidir: 400 é mais seguro,
evita perda silenciosa de dado que o chamador achava que ia salvar).

**Step 2: Verificar**

```bash
curl http://localhost:3000/api/clientes/<id> -H "Cookie: ..."
```
Confere que `negociacoes` vem no JSON.

**Step 3: Commit**

```bash
git add src/app/api/clientes/route.ts "src/app/api/clientes/[id]/route.ts"
git commit -m "feat: GET clientes inclui negociacoes e followups"
```

---

### Task 4.3: `/api/clientes/batch` (OCR) — normalização de duplicado

**Files:**
- Modify: `src/app/api/clientes/batch/route.ts:67-68`

**Step 1:** Trocar `username.toLowerCase()` / `existingUsernames` (match
exato) por `normalizarInstagram()` (Task 2.1) comparado contra
`instagram_normalizado` do banco.

**Step 2: Verificar**

Testar manualmente pela UI de import (`InstagramOCRImport.tsx`) com um
username que já existe em variação de case/@ — deve marcar `isDuplicate`.

**Step 3: Commit**

```bash
git add src/app/api/clientes/batch/route.ts
git commit -m "fix: batch import usa normalizacao de instagram pra detectar duplicado"
```

---

## Fase 5 — Webhooks

### Task 5.1: WAHA webhook

**Files:**
- Modify: `src/app/api/webhooks/waha/route.ts:103-117`

**Step 1:** Trocar chamada de `create_lead_dedup` por `find_or_create_cliente`.
Depois da chamada, **sempre** criar uma negociação nova associada (INSERT em
`negociacoes` com `resultado: 'Orçamento em Processo'` default, `data_contato`
= data do evento) — isso corrige o bug documentado no inventário (hoje, se
`created: false`, a linha 117 retorna sem registrar nada do evento).

**Step 2: Verificar**

Simular o payload do webhook via `curl` contra
`/api/webhooks/waha` (ver formato esperado no início do arquivo) duas vezes
pro mesmo telefone — 2ª vez deve gerar negociação nova no cliente já
existente, não cliente duplicado.

**Step 3: Commit**

```bash
git add src/app/api/webhooks/waha/route.ts
git commit -m "fix: webhook WAHA usa find_or_create_cliente, sempre registra negociacao"
```

---

### Task 5.2: Instagram webhook

**Files:**
- Modify: `src/app/api/webhooks/instagram/route.ts:61-68`

**Step 1:** Mesma troca da Task 5.1, adaptada ao identificador
(`@username`/`sender.id`) e ao loop `for entry/messaging`.

**Step 2: Verificar** — mesmo padrão da Task 5.1 com payload do Instagram.

**Step 3: Commit**

```bash
git add src/app/api/webhooks/instagram/route.ts
git commit -m "fix: webhook Instagram usa find_or_create_cliente, sempre registra negociacao"
```

---

### Task 5.3: Remover `create_lead_dedup`

**Files:**
- Create: `supabase/migrations/20260902100700_drop_create_lead_dedup.sql`

**Step 1:**
```sql
drop function if exists public.create_lead_dedup(uuid, date, text, text, text, uuid);
```

**Step 2:** Confirmar via `grep -rn "create_lead_dedup" src/` — deve retornar
vazio antes de aplicar essa migration (senão as Tasks 5.1/5.2 não terminaram).

**Step 3: Aplicar via MCP e commit**

```bash
git add supabase/migrations/20260902100700_drop_create_lead_dedup.sql
git commit -m "chore: remove create_lead_dedup, substituida por find_or_create_cliente"
```

---

## Fase 6 — UI

### Task 6.1: `NegociacaoForm` (extraído do `ClienteModal`)

**Files:**
- Create: `src/components/NegociacaoForm.tsx`
- Reference: `src/components/ClienteModal.tsx:290-410` (bloco a extrair), `72-74` (parsers de moeda)

**Step 1:** Componente controlado `{ negociacao?, onSave, onCancel, currency }`
com os campos: `orcamentoEnviado`, `resultado`, `qualidadeContato`,
`naoRespondeu`, `valorFechado` (+ parser de moeda), bloco condicional de
pagamento (`pagouSinal/valorSinal/dataPagamentoSinal/vendaPaga/dataPagamentoVenda`),
`dataLembreteChamada`, `observacao`. Copiar o JSX/lógica de validação das
linhas referenciadas, adaptando pra `NovaNegociacao`/`Negociacao`.

**Step 2: Verificar** — sem uso ainda (entra na página da Task 6.3); só
`pnpm tsc --noEmit` limpo nesse arquivo isoladamente.

**Step 3: Commit**

```bash
git add src/components/NegociacaoForm.tsx
git commit -m "feat: extrai NegociacaoForm do ClienteModal"
```

---

### Task 6.2: `ClienteForm` — remove campos de negociação (fica só cadastro de pessoa)

**Files:**
- Modify: `src/components/ClienteForm.tsx:124-183` (remove blocos de
  `orcamentoEnviado`, `resultado`, `qualidadeContato`, `valorFechado`)

**Step 1:** Remove os campos de negociação; mantém `dataContato` (1º
contato), `nome`, `whatsappInstagram`, `origem`, `observacao`. Esse form
passa a ser usado só na criação inicial de um lead (sem negociação junto —
ou, se o design pedir criar já com a 1ª negociação, decidir no momento:
recomendo manter simples aqui e deixar `NegociacaoForm` (Task 6.1) opcional
logo após criar, dentro da página nova).

**Step 2: Verificar** — `pnpm tsc --noEmit` limpo neste arquivo.

**Step 3: Commit**

```bash
git add src/components/ClienteForm.tsx
git commit -m "feat: ClienteForm so cadastra dados da pessoa"
```

---

### Task 6.3: Página `/leads/[id]`

**Files:**
- Create: `src/app/leads/[id]/page.tsx`

**Step 1:** Server/client component: busca cliente (via `useClientes` ou
fetch direto Supabase client-side), lista `negociacoes` (via
`useNegociacoes`) e `followups` (via hook existente). Renderiza:
- Header: nome, whatsapp/insta, origem, data 1º contato, categoria.
- KPIs: LTV (`sum(valorFechado) where resultado = 'Venda'`), total de
  negociações, total vendas fechadas, data última interação (`max` entre
  negociações e follow-ups).
- Timeline: negociações + follow-ups intercalados por data desc, cada
  negociação expansível mostrando detalhes.
- Botão "Nova negociação" abre `NegociacaoForm` (Task 6.1) em modal simples
  ou seção inline.
- Form de edição de dados da pessoa (nome/contato/categoria), usando
  `editarCliente` (Task 3.2).

**Step 2: Verificar no browser**

`pnpm dev`, navegar até `/leads/<id-real>`, conferir: KPIs batem com dados
reais (conferir LTV manualmente via SQL pro mesmo cliente), criar negociação
nova pela UI e ver aparecer na timeline sem refresh, editar dado da pessoa e
confirmar persistência (reload da página).

**Step 3: Commit**

```bash
git add "src/app/leads/[id]/page.tsx"
git commit -m "feat: pagina de detalhe do lead com timeline e LTV"
```

---

### Task 6.4: Navegação — `ClienteTable`, `page.tsx`, `clientes/page.tsx`

**Files:**
- Modify: `src/app/page.tsx:92,217-234`
- Modify: `src/app/clientes/page.tsx:256-267,47`
- Modify: `src/components/ClienteTable.tsx:386,401,408,550,566,578`

**Step 1:** `page.tsx`/`clientes/page.tsx`: `onEdit`/`handleViewHistory`
passam a usar `useRouter().push('/leads/' + cliente.id)` em vez de abrir
`ClienteModal`. Remove `clienteEditando` state e `<ClienteModal>` dos dois
arquivos.

**Step 2:** `clientes/page.tsx:47` — filtro `resultado: 'Venda'` (que hoje lê
campo direto de `Cliente`) vira filtro por `negociacoes` (existe ao menos uma
negociação com `resultado = 'Venda'` pro cliente) — via join na query do
Task 3.2 ou uma query separada com `.in('cliente_id', ...)`.

**Step 3:** `ClienteTable.tsx` — coluna resultado/valor lê
`cliente.ultimaNegociacao` (populado pela query da Task 3.2) em vez de
`cliente.resultado`/`cliente.valorFechado` diretos.

**Step 4: Verificar no browser**

`pnpm dev`, abrir `/`, clicar numa linha da tabela → navega pra
`/leads/[id]`. Abrir `/clientes` → lista só quem tem venda fechada, clicar
numa linha → mesma navegação.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/clientes/page.tsx src/components/ClienteTable.tsx
git commit -m "feat: navegacao da tabela vai pra /leads/[id], remove ClienteModal"
```

---

### Task 6.5: Remover `ClienteModal.tsx`

**Files:**
- Delete: `src/components/ClienteModal.tsx`

**Step 1:** Confirmar via `grep -rn "ClienteModal" src/` que não sobrou
nenhum import (deve ter zerado depois da Task 6.4).

**Step 2:** `rm src/components/ClienteModal.tsx`, `pnpm tsc --noEmit` limpo.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove ClienteModal, substituido pela pagina /leads/[id]"
```

---

### Task 6.6: `InstagramOCRImport.tsx` — `isDuplicate` com normalização

**Files:**
- Modify: `src/components/cliente/InstagramOCRImport.tsx:88,94,135-136,288,296,301,308`

**Step 1:** Confirma que o backend (Task 4.3) já popula `isDuplicate` via
normalização — client só consome o campo, sem mudança de lógica aqui a menos
que haja checagem duplicada no client (revisar as linhas listadas).

**Step 2: Verificar** — testar fluxo de import de novo (mesmo teste da Task
4.3, mas fim a fim pela UI).

**Step 3: Commit** (só se algo mudou; senão pular)

---

## Fase 7 — Dashboard

### Task 7.1: `dashboard/page.tsx` — query e cálculo de KPIs

**Files:**
- Modify: `src/app/dashboard/page.tsx:138-145` (query)
- Modify: `src/app/dashboard/page.tsx:168-209` (loop de agregação)

**Step 1:** Trocar `supabase.from('clientes').select('data_contato,
data_mes_venda, resultado, valor_fechado, pagou_sinal, venda_paga,
data_lembrete_chamada')` por `supabase.from('negociacoes').select(...)` com
os mesmos campos (agora em `negociacoes`, com `data_mes_venda` já como
coluna gerada lá — Task 0.3). Filtro de período usa `negociacoes.data_mes_venda`
(decisão confirmada). Loop de agregação (linhas 168-209) não muda a lógica
interna, só a origem do dado.

**Step 2: Verificar no browser**

`pnpm dev`, abrir `/dashboard`, comparar os números de um mês específico
contra uma query manual equivalente via MCP Supabase pra conferir que bate.

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: dashboard le KPIs de negociacoes"
```

---

## Fase 8 — Limpeza final

### Task 8.1: Build limpo + grep de campos removidos

**Step 1:**
```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```
Todos devem passar sem erro.

**Step 2:**
```bash
grep -rn "resultado\|valorFechado\|orcamentoEnviado\|pagouSinal\|vendaPaga\|qualidadeContato\|naoRespondeu" src/ | grep -v "Negociacao\|negociacoes"
```
Revisar cada ocorrência — deve sobrar só uso legítimo em contexto de
negociação (nomes de variável reaproveitados, não bug).

**Step 3:** Reportar ao usuário: nº de leads mesclados (da Task 0.5), build
limpo, pronto pra revisão manual completa no browser antes de merge pra
`main`.

**Step 4: Commit** (se sobrar algum ajuste) e então usar
superpowers:finishing-a-development-branch pra decidir merge/PR.
