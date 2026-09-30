-- Webhooks/service role: lead vai para a empresa de ORIGEM do usuário, nunca a visitada
-- pelo superadmin (active_tenant_id). Chamadas via JWT (UI) continuam usando a visitada.

create or replace function public.home_tenant_id(p_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select up.tenant_id
    from user_profiles up
    left join tenants t on t.id = up.tenant_id
   where up.id = p_user_id
     and up.is_active
     and (up.role = 'admin' or t.is_active);
$$;

create or replace function public.tenant_para_escrita(p_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case when public.is_trusted_context()
              then public.home_tenant_id(p_user_id)
              else public.effective_tenant_id(p_user_id) end;
$$;

revoke execute on function public.home_tenant_id(uuid), public.tenant_para_escrita(uuid) from public, anon, authenticated;

create or replace function public.set_cliente_tenant_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.tenant_para_escrita(coalesce(NEW.user_id, auth.uid()));
  end if;
  if NEW.tenant_id is null then
    raise exception 'usuario sem empresa ativa';
  end if;
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;
$$;

create or replace function public.auto_fill_user_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.tenant_para_escrita(coalesce(NEW.user_id, auth.uid()));
  end if;
  if TG_OP = 'INSERT' and NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  if TG_OP = 'UPDATE' then
    NEW.updated_by := auth.uid();
  end if;
  return NEW;
end;
$$;

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
  v_tenant := public.tenant_para_escrita(p_user_id);
  if v_tenant is null then
    raise exception 'usuario sem empresa ativa';
  end if;

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

-- Update de cliente: dono do lead (user_id) precisa ser da mesma empresa.
drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update
  using (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())))
  with check (tenant_id = (select public.current_tenant_id())
              and exists (select 1 from public.user_profiles up
                           where up.id = clientes.user_id
                             and (up.tenant_id = clientes.tenant_id or up.role = 'admin')));
