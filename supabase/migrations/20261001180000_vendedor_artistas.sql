-- Vendedor atende artistas: não tem leads próprios, opera (vê/cria/edita) os leads
-- dos artistas vinculados. Vínculo definido pelo dono em /empresa.
create table if not exists public.vendedor_artistas (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  vendedor_id uuid not null references public.user_profiles(id) on delete cascade,
  artista_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vendedor_id, artista_id)
);
create index if not exists vendedor_artistas_artista_idx on public.vendedor_artistas (artista_id);
alter table public.vendedor_artistas enable row level security;

drop policy if exists vendedor_artistas_select on public.vendedor_artistas;
create policy vendedor_artistas_select on public.vendedor_artistas for select using (
  vendedor_id = (select auth.uid())
  or (tenant_id = (select public.current_tenant_id()) and (select public.ve_empresa_toda()))
);
-- escrita: só service role (rota do dono)

-- Usuário logado (vendedor ativo) atende o artista na empresa atual?
create or replace function public.atende_artista(p_artista uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
      from vendedor_artistas va
      join user_profiles v on v.id = va.vendedor_id
     where va.vendedor_id = auth.uid()
       and va.artista_id = p_artista
       and va.tenant_id = public.current_tenant_id()
       and v.role = 'vendedor' and v.is_active
  );
$$;

-- Leitura/escrita de lead pelo responsável (user_id do cliente)
create or replace function public.pode_ver_lead(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_user = auth.uid() or public.ve_empresa_toda() or public.atende_artista(p_user);
$$;

create or replace function public.pode_operar_lead(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_user = auth.uid() or public.is_tenant_owner() or public.atende_artista(p_user);
$$;

revoke execute on function public.atende_artista(uuid) from anon, public;
revoke execute on function public.pode_ver_lead(uuid) from anon, public;
revoke execute on function public.pode_operar_lead(uuid) from anon, public;
grant execute on function public.atende_artista(uuid) to authenticated;
grant execute on function public.pode_ver_lead(uuid) to authenticated;
grant execute on function public.pode_operar_lead(uuid) to authenticated;

-- clientes
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select using (
  tenant_id = (select public.current_tenant_id()) and public.pode_ver_lead(user_id)
);
drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes for insert with check (
  tenant_id = (select public.current_tenant_id())
  and public.pode_operar_lead(user_id)
  and public.responsavel_valido(user_id, tenant_id)
);
drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update
  using (tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(user_id))
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.pode_operar_lead(user_id)
    and public.responsavel_valido(user_id, tenant_id)
  );
drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes for delete using (
  tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(user_id)
);

-- negociacoes
drop policy if exists negociacoes_select on public.negociacoes;
create policy negociacoes_select on public.negociacoes for select using (
  exists (select 1 from clientes c where c.id = negociacoes.cliente_id
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_ver_lead(c.user_id))
);
drop policy if exists negociacoes_insert on public.negociacoes;
create policy negociacoes_insert on public.negociacoes for insert with check (
  exists (select 1 from clientes c where c.id = negociacoes.cliente_id
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);
drop policy if exists negociacoes_update on public.negociacoes;
create policy negociacoes_update on public.negociacoes for update using (
  exists (select 1 from clientes c where c.id = negociacoes.cliente_id
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);
drop policy if exists negociacoes_delete on public.negociacoes;
create policy negociacoes_delete on public.negociacoes for delete using (
  exists (select 1 from clientes c where c.id = negociacoes.cliente_id
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);

-- follow_ups (delete continua: autor ou dono)
drop policy if exists follow_ups_select on public.follow_ups;
create policy follow_ups_select on public.follow_ups for select using (
  exists (select 1 from clientes c where c.id = follow_ups.cliente_id
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_ver_lead(c.user_id))
);
drop policy if exists follow_ups_insert on public.follow_ups;
create policy follow_ups_insert on public.follow_ups for insert with check (
  exists (select 1 from clientes c where c.id = follow_ups.cliente_id
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);

-- find_or_create_cliente: vendedor cria lead p/ artista que atende
do $$
declare
  v_def text := pg_get_functiondef('public.find_or_create_cliente(uuid,date,text,text,text,uuid)'::regprocedure);
  v_old text := 'and not (public.is_tenant_owner() and v_tenant = public.current_tenant_id()) then';
  v_new text := 'and not ((public.is_tenant_owner() or public.atende_artista(p_user_id)) and v_tenant = public.current_tenant_id()) then';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'find_or_create_cliente mudou; ajustar migration';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
