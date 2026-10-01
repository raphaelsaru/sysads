-- Dono multi-empresa: empresa efetiva cai p/ primária (ou outra vinculada ativa)
-- quando a escolhida está inativa; acesso_crm passa a avaliar a empresa efetiva.

create or replace function public.effective_tenant_id(p_user_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select case
    when up.role = 'admin' then coalesce(up.active_tenant_id, up.tenant_id)
    else coalesce(
      -- vinculada escolhida (só owner com vínculo)
      (select t.id from tenants t
         join tenant_owners o on o.tenant_id = t.id and o.user_id = up.id
        where up.role = 'owner' and t.id = up.active_tenant_id and t.is_active),
      -- primária
      (select t.id from tenants t where t.id = up.tenant_id and t.is_active),
      -- primária inativa: primeira vinculada ativa
      (select t.id from tenants t
         join tenant_owners o on o.tenant_id = t.id and o.user_id = up.id
        where up.role = 'owner' and t.is_active
        order by o.created_at limit 1)
    )
  end
  from user_profiles up
  where up.id = p_user_id and up.is_active;
$$;

create or replace function public.acesso_crm()
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when up.id is null then 'sem_perfil'
    when not up.is_active then 'usuario_inativo'
    when up.role = 'admin' then 'ok'
    when up.tenant_id is null then 'sem_empresa'
    when public.effective_tenant_id(up.id) is null then 'empresa_inativa'
    else 'ok'
  end
  from (select auth.uid() as uid) s
  left join user_profiles up on up.id = s.uid;
$$;

-- Vínculo só vale p/ owner (coerente com effective_tenant_id)
create or replace function public.responsavel_valido(p_user uuid, p_tenant uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from user_profiles up
     where up.id = p_user
       and (up.tenant_id = p_tenant
            or up.role = 'admin'
            or (up.role = 'owner' and exists (select 1 from tenant_owners o
                                               where o.user_id = up.id and o.tenant_id = p_tenant)))
  );
$$;

-- INSERT também valida o responsável (owner não cria lead p/ usuário de outra empresa)
drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes for insert with check (
  tenant_id = (select public.current_tenant_id())
  and (user_id = (select auth.uid()) or (select public.is_tenant_owner()))
  and public.responsavel_valido(user_id, tenant_id)
);
