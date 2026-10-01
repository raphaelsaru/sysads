-- Responsável do lead pertence à empresa? (primária, superadmin ou dono vinculado)
-- Security definer: o WITH CHECK não pode depender da visibilidade de user_profiles
-- (dono local não enxerga o perfil de dono vinculado de outra empresa).
create or replace function public.responsavel_valido(p_user uuid, p_tenant uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from user_profiles up
     where up.id = p_user
       and (up.tenant_id = p_tenant
            or up.role = 'admin'
            or exists (select 1 from tenant_owners o
                        where o.user_id = up.id and o.tenant_id = p_tenant))
  );
$$;

drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update
  using (
    tenant_id = (select public.current_tenant_id())
    and (user_id = (select auth.uid()) or (select public.is_tenant_owner()))
  )
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.responsavel_valido(user_id, tenant_id)
  );

revoke execute on function public.ve_empresa_toda() from anon, public;
revoke execute on function public.responsavel_valido(uuid, uuid) from anon, public;
grant execute on function public.ve_empresa_toda() to authenticated;
grant execute on function public.responsavel_valido(uuid, uuid) to authenticated;
