drop index if exists public.clientes_telefone_normalizado_uidx;
drop index if exists public.clientes_instagram_normalizado_uidx;

create unique index clientes_tenant_telefone_normalizado_uidx
  on public.clientes (tenant_id, telefone_normalizado) where telefone_normalizado is not null;
create unique index clientes_tenant_instagram_normalizado_uidx
  on public.clientes (tenant_id, instagram_normalizado) where instagram_normalizado is not null;

create or replace function public.find_or_create_cliente(
  p_user_id uuid, p_data_contato date, p_nome text, p_identificador text, p_origem text, p_created_by uuid
)
returns table(id uuid, created boolean)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid;
  v_tenant uuid;
  v_tel text := public.normalizar_telefone(p_identificador);
  v_insta text := public.normalizar_instagram(p_identificador);
begin
  v_tenant := public.effective_tenant_id(p_user_id);
  if v_tenant is null then
    raise exception 'usuario sem empresa ativa';
  end if;

  -- Fora de service role: só p/ si mesmo, ou owner/superadmin p/ alguém da empresa atual.
  if not public.is_trusted_context() then
    if p_user_id is distinct from auth.uid()
       and not (public.is_tenant_owner() and v_tenant = public.current_tenant_id()) then
      raise exception 'p_user_id invalido';
    end if;
    p_created_by := auth.uid();
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant::text || ':' || coalesce(v_tel, v_insta, p_identificador), 0));

  select c.id into v_id from clientes c
   where c.tenant_id = v_tenant
     and ((v_tel is not null and c.telefone_normalizado = v_tel)
       or (v_insta is not null and c.instagram_normalizado = v_insta))
   order by c.created_at
   limit 1;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  begin
    insert into clientes (tenant_id, user_id, data_contato, nome, whatsapp_instagram, origem, created_by, updated_by)
    values (v_tenant, p_user_id, p_data_contato, p_nome, p_identificador, p_origem::origem_tipo, p_created_by, p_created_by)
    returning clientes.id into v_id;
  exception when unique_violation then
    select c.id into v_id from clientes c
     where c.tenant_id = v_tenant
       and ((v_tel is not null and c.telefone_normalizado = v_tel)
         or (v_insta is not null and c.instagram_normalizado = v_insta))
     order by c.created_at
     limit 1;
    return query select v_id, false;
    return;
  end;

  return query select v_id, true;
end;
$function$;

revoke execute on function public.find_or_create_cliente(uuid, date, text, text, text, uuid) from public, anon;
grant execute on function public.find_or_create_cliente(uuid, date, text, text, text, uuid) to authenticated, service_role;
