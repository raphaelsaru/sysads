-- Empresa com vários donos; dono em várias empresas. Substitui definir_dono (que rebaixava
-- os outros donos). Chamadas só por rotas de servidor (service role), que validam quem pede.
-- Dono "da empresa" = membro (user_profiles.tenant_id) com role owner; "vinculado" = tenant_owners.

-- Donos ativos da empresa (membros + vinculados)
create or replace function public.contar_donos_ativos(p_tenant uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from (
    select id from user_profiles where tenant_id = p_tenant and role = 'owner' and is_active
    union
    select o.user_id from tenant_owners o join user_profiles u on u.id = o.user_id
     where o.tenant_id = p_tenant and u.role = 'owner' and u.is_active
  ) s;
$$;

-- Membro vira dono (promove) ou dono de outra empresa ganha vínculo. Não rebaixa ninguém.
create or replace function public.adicionar_dono(p_tenant uuid, p_user uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v user_profiles%rowtype;
begin
  perform 1 from tenants where id = p_tenant for update;
  if not found then raise exception 'empresa inexistente'; end if;

  select * into v from user_profiles where id = p_user;
  if not found or not v.is_active then raise exception 'usuario invalido'; end if;
  if v.role = 'admin' then raise exception 'superadmin nao vira dono'; end if;

  if v.tenant_id = p_tenant then
    if v.role = 'owner' then raise exception 'ja e dono'; end if;
    update user_profiles set role = 'owner' where id = p_user;
    delete from vendedor_artistas where vendedor_id = p_user; -- vínculos de vendedor perdem sentido
    return 'promovido';
  end if;

  if v.role <> 'owner' then raise exception 'usuario de outra empresa nao e dono'; end if;
  if exists (select 1 from tenant_owners where tenant_id = p_tenant and user_id = p_user) then
    raise exception 'ja e dono';
  end if;
  insert into tenant_owners (tenant_id, user_id) values (p_tenant, p_user);
  return 'vinculado';
end;
$$;

-- Remove dono: vinculado perde o vínculo; membro vira Artista. Nunca deixa a empresa sem dono.
create or replace function public.remover_dono(p_tenant uuid, p_user uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_membro boolean;
  v_vinculo boolean;
begin
  perform 1 from tenants where id = p_tenant for update;
  if not found then raise exception 'empresa inexistente'; end if;

  v_membro := exists (select 1 from user_profiles where id = p_user and tenant_id = p_tenant and role = 'owner');
  v_vinculo := exists (select 1 from tenant_owners where tenant_id = p_tenant and user_id = p_user);
  if not v_membro and not v_vinculo then raise exception 'nao e dono'; end if;

  if public.contar_donos_ativos(p_tenant) <= 1
     and exists (select 1 from user_profiles where id = p_user and is_active) then
    raise exception 'ultimo dono';
  end if;

  if v_vinculo then
    delete from tenant_owners where tenant_id = p_tenant and user_id = p_user;
    update user_profiles set active_tenant_id = null where id = p_user and active_tenant_id = p_tenant;
    return 'desvinculado';
  end if;

  -- Rebaixar quebraria os vínculos dele em outras empresas
  if exists (select 1 from tenant_owners where user_id = p_user) then
    raise exception 'dono de outras empresas';
  end if;
  update user_profiles set role = 'user' where id = p_user;
  return 'rebaixado';
end;
$$;

revoke execute on function public.contar_donos_ativos(uuid) from public, anon, authenticated;
revoke execute on function public.adicionar_dono(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.remover_dono(uuid, uuid) from public, anon, authenticated;
grant execute on function public.contar_donos_ativos(uuid) to service_role;
grant execute on function public.adicionar_dono(uuid, uuid) to service_role;
grant execute on function public.remover_dono(uuid, uuid) to service_role;

-- definir_dono fica até o deploy do app novo (produção ainda chama); remover depois.
