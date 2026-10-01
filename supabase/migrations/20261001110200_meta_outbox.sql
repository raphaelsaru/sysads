create table public.meta_event_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  event_name text not null check (event_name in ('Contact', 'Lead', 'Purchase')),
  event_id text not null,
  entity_type text not null,
  entity_id uuid not null,
  event_time timestamptz not null,
  payload jsonb not null default '{}'::jsonb, -- sem PII (ex.: value)
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_error text,
  meta_response jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (tenant_id, event_id)
);
create index meta_event_outbox_fila_idx on public.meta_event_outbox (status, next_attempt_at);
create index meta_event_outbox_tenant_idx on public.meta_event_outbox (tenant_id, created_at desc);

alter table public.meta_event_outbox enable row level security;
revoke all on public.meta_event_outbox from anon, authenticated;

create or replace function public.meta_enfileirar_negociacao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_origem text;
begin
  select c.origem::text into v_origem from public.clientes c where c.id = new.cliente_id;
  if new.meta_ad_id is null and coalesce(v_origem, '') not like 'Anúncio%' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.meta_event_outbox (tenant_id, event_name, event_id, entity_type, entity_id, event_time)
    values (new.tenant_id, 'Contact', 'negociacao:' || new.id || ':contact', 'negociacao', new.id, new.created_at)
    on conflict (tenant_id, event_id) do nothing;
  end if;

  if new.qualidade_contato = 'Bom' or new.orcamento_enviado then
    insert into public.meta_event_outbox (tenant_id, event_name, event_id, entity_type, entity_id, event_time)
    values (new.tenant_id, 'Lead', 'negociacao:' || new.id || ':lead', 'negociacao', new.id, now())
    on conflict (tenant_id, event_id) do nothing;
  end if;

  if new.resultado = 'Venda' and coalesce(new.valor_fechado, 0) > 0 then
    insert into public.meta_event_outbox (tenant_id, event_name, event_id, entity_type, entity_id, event_time, payload)
    values (new.tenant_id, 'Purchase', 'negociacao:' || new.id || ':purchase', 'negociacao', new.id, now(),
            jsonb_build_object('value', new.valor_fechado))
    on conflict (tenant_id, event_id) do nothing;
  end if;

  return new;
end $$;

create trigger negociacoes_meta_outbox
  after insert or update on public.negociacoes
  for each row execute function public.meta_enfileirar_negociacao();

-- Pega lote p/ envio. Só tenants com integração ativa. Reaproveita 'processing'
-- travado (>10 min, ex.: função morreu no meio).
create or replace function public.claim_meta_events(p_limit int default 50)
returns setof public.meta_event_outbox language sql security definer set search_path = public as $$
  update public.meta_event_outbox o
     set status = 'processing', claimed_at = now()
   where o.id in (
     select e.id from public.meta_event_outbox e
     join public.meta_integrations i on i.tenant_id = e.tenant_id and i.is_active
     where (e.status = 'pending' and e.next_attempt_at <= now())
        or (e.status = 'processing' and e.claimed_at < now() - interval '10 minutes')
     order by e.next_attempt_at
     limit p_limit
     for update of e skip locked
   )
  returning o.*;
$$;
revoke all on function public.claim_meta_events(int) from public, anon, authenticated;
grant execute on function public.claim_meta_events(int) to service_role;
