-- Troca de dono atômica: promove p_user e rebaixa os demais owners da empresa numa transação.
-- Só service role (rota /api/admin/empresas/[id] autoriza superadmin antes).
create or replace function public.definir_dono(p_tenant uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- serializa trocas concorrentes na mesma empresa
  perform 1 from tenants where id = p_tenant for update;
  if not found then
    raise exception 'empresa inexistente';
  end if;

  if not exists (
    select 1 from user_profiles
     where id = p_user and tenant_id = p_tenant and is_active and role <> 'admin'
  ) then
    raise exception 'dono invalido';
  end if;

  update user_profiles
     set role = case when id = p_user then 'owner'::user_role else 'user'::user_role end
   where tenant_id = p_tenant
     and role <> 'admin'
     and (id = p_user or role = 'owner');
end;
$$;

revoke execute on function public.definir_dono(uuid, uuid) from public, anon, authenticated;
grant execute on function public.definir_dono(uuid, uuid) to service_role;
