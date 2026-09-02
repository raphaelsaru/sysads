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
