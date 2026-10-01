-- Dono de múltiplas empresas: vínculos extras (empresa primária continua em user_profiles.tenant_id).
-- Vínculos extras não ocupam slot (validar_slots conta só tenant_id).
create table if not exists public.tenant_owners (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_owners_user_idx on public.tenant_owners (user_id);
alter table public.tenant_owners enable row level security;

drop policy if exists tenant_owners_select on public.tenant_owners;
create policy tenant_owners_select on public.tenant_owners for select
  using (user_id = (select auth.uid()) or (select public.is_superadmin()));
-- escrita: só service role (rotas superadmin)

-- Empresa efetiva: superadmin visita qualquer uma; owner visita as vinculadas.
create or replace function public.effective_tenant_id(p_user_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select case
    when up.role = 'admin' then coalesce(up.active_tenant_id, up.tenant_id)
    else (
      select t.id from tenants t
       where t.is_active
         and t.id = case
           when up.role = 'owner' and up.active_tenant_id is not null
                and exists (select 1 from tenant_owners o
                             where o.user_id = up.id and o.tenant_id = up.active_tenant_id)
             then up.active_tenant_id
           else up.tenant_id
         end
    )
  end
  from user_profiles up
  where up.id = p_user_id and up.is_active;
$$;

-- Leitura de toda a empresa: superadmin, dono, gestor.
create or replace function public.ve_empresa_toda()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from user_profiles
     where id = auth.uid() and role in ('admin', 'owner', 'gestor') and is_active
  ) and public.current_tenant_id() is not null;
$$;

-- SELECT passa a usar ve_empresa_toda; INSERT/UPDATE/DELETE seguem is_tenant_owner (gestor só os próprios).
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select using (
  tenant_id = (select public.current_tenant_id())
  and (user_id = (select auth.uid()) or (select public.ve_empresa_toda()))
);

drop policy if exists negociacoes_select on public.negociacoes;
create policy negociacoes_select on public.negociacoes for select using (
  exists (select 1 from clientes c
           where c.id = negociacoes.cliente_id
             and c.tenant_id = (select public.current_tenant_id())
             and (c.user_id = (select auth.uid()) or (select public.ve_empresa_toda())))
);

drop policy if exists follow_ups_select on public.follow_ups;
create policy follow_ups_select on public.follow_ups for select using (
  exists (select 1 from clientes c
           where c.id = follow_ups.cliente_id
             and c.tenant_id = (select public.current_tenant_id())
             and (c.user_id = (select auth.uid()) or (select public.ve_empresa_toda())))
);

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles for select using (
  id = (select auth.uid())
  or (select public.is_superadmin())
  or (tenant_id = (select public.current_tenant_id()) and (select public.ve_empresa_toda()))
);

-- Dono em empresa vinculada: lead dele (user_id = dono) é válido nessa empresa.
drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update
  using (
    tenant_id = (select public.current_tenant_id())
    and (user_id = (select auth.uid()) or (select public.is_tenant_owner()))
  )
  with check (
    tenant_id = (select public.current_tenant_id())
    and exists (
      select 1 from user_profiles up
       where up.id = clientes.user_id
         and (up.tenant_id = clientes.tenant_id
              or up.role = 'admin'
              or exists (select 1 from tenant_owners o
                          where o.user_id = up.id and o.tenant_id = clientes.tenant_id))
    )
  );
