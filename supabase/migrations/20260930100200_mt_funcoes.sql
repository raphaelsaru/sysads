-- Contexto confiável: service role (JWT role) ou conexão direta sem JWT (migration/psql).
create or replace function public.is_trusted_context()
returns boolean language sql stable set search_path = public as $$
  select case
    when nullif(current_setting('request.jwt.claims', true), '') is null then true
    else coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
  end;
$$;

-- Empresa efetiva de um usuário. Superadmin: empresa visitada (fallback própria).
-- Null se usuário inativo, ou empresa inativa (exceto superadmin).
create or replace function public.effective_tenant_id(p_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case when up.role = 'admin' then coalesce(up.active_tenant_id, up.tenant_id) else up.tenant_id end
    from user_profiles up
    left join tenants t on t.id = up.tenant_id
   where up.id = p_user_id
     and up.is_active
     and (up.role = 'admin' or t.is_active);
$$;

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select public.effective_tenant_id(auth.uid());
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- Owner ou superadmin (superadmin é dono de qualquer empresa que visita).
-- Usar sempre junto com tenant_id = current_tenant_id().
create or replace function public.is_tenant_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles
     where id = auth.uid() and role in ('admin', 'owner') and is_active
  ) and public.current_tenant_id() is not null;
$$;

-- Mantido por compatibilidade (get_all_users_admin, get_user_clientes_admin, policy de backup).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin();
$$;

-- Status de acesso ao CRM, lido pelo middleware.
create or replace function public.acesso_crm()
returns text language sql stable security definer set search_path = public as $$
  select case
    when up.id is null then 'sem_perfil'
    when not up.is_active then 'usuario_inativo'
    when up.role = 'admin' then 'ok'
    when up.tenant_id is null then 'sem_empresa'
    when not t.is_active then 'empresa_inativa'
    else 'ok'
  end
  from (select auth.uid() as uid) s
  left join user_profiles up on up.id = s.uid
  left join tenants t on t.id = up.tenant_id;
$$;

revoke execute on function public.effective_tenant_id(uuid), public.is_trusted_context() from public, anon, authenticated;
-- Funções usadas em policies ficam executáveis por anon (retornam null/false sem JWT).
grant execute on function public.current_tenant_id(), public.is_superadmin(), public.is_tenant_owner(), public.acesso_crm(), public.is_admin() to authenticated;
