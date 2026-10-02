-- Auditoria: soft delete = exclusão; restauração (deleted_at volta a null) = "restaurou";
-- DELETE real (superadmin/lixeira) marcado como definitivo.
create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_ator uuid := auth.uid();
  v_old jsonb := case when TG_OP <> 'INSERT' then to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP <> 'DELETE' then to_jsonb(NEW) end;
  v_row jsonb;
  v_mud jsonb := '{}'::jsonb;
  v_op text := TG_OP;
  v_tenant uuid;
  v_id uuid;
  v_rotulo text;
  c text;
  v_soft boolean := false;
  v_rest boolean := false;
begin
  if v_ator is null then
    begin
      v_ator := nullif(current_setting('request.headers', true)::json ->> 'x-prizely-ator', '')::uuid;
    exception when others then
      v_ator := null;
    end;
  end if;
  if v_ator is null then
    return null; -- automático
  end if;

  v_row := coalesce(v_new, v_old);

  if TG_OP = 'UPDATE' and v_old ? 'deleted_at' then
    v_soft := (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null;
    v_rest := (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null;
  end if;

  if v_soft then
    v_op := 'DELETE';
  elsif v_rest then
    v_mud := '{"restaurado": true}'::jsonb;
  else
    foreach c in array TG_ARGV loop
      if TG_OP = 'UPDATE' then
        if (v_old -> c) is distinct from (v_new -> c) then
          v_mud := v_mud || jsonb_build_object(c, jsonb_build_array(v_old -> c, v_new -> c));
        end if;
      elsif coalesce(v_row -> c, 'null'::jsonb) <> 'null'::jsonb then
        v_mud := v_mud || jsonb_build_object(c, v_row -> c);
      end if;
    end loop;
    if TG_OP = 'UPDATE' and v_mud = '{}'::jsonb then
      return null; -- nada auditado mudou
    end if;
    if TG_OP = 'DELETE' then
      v_mud := v_mud || '{"definitivo": true}'::jsonb; -- DELETE real só por superadmin/sistema
    end if;
  end if;

  case TG_TABLE_NAME
    when 'clientes' then
      v_tenant := (v_row ->> 'tenant_id')::uuid;
      v_id := (v_row ->> 'id')::uuid;
      v_rotulo := v_row ->> 'nome';
    when 'negociacoes', 'follow_ups' then
      v_tenant := (v_row ->> 'tenant_id')::uuid;
      v_id := (v_row ->> 'cliente_id')::uuid;
      select nome into v_rotulo from clientes where id = v_id;
      -- exclusão em cascata do cliente: já registrada no próprio cliente
      if TG_OP = 'DELETE' and v_rotulo is null then
        return null;
      end if;
    when 'user_profiles' then
      v_tenant := (v_row ->> 'tenant_id')::uuid;
      v_id := (v_row ->> 'id')::uuid;
      v_rotulo := v_row ->> 'full_name';
    when 'tenants' then
      v_tenant := (v_row ->> 'id')::uuid;
      v_id := v_tenant;
      v_rotulo := v_row ->> 'name';
    when 'vendedor_artistas' then
      v_tenant := (v_row ->> 'tenant_id')::uuid;
      v_id := (v_row ->> 'vendedor_id')::uuid;
      select coalesce(v.full_name, '?') || ' → ' || coalesce(a.full_name, '?') into v_rotulo
        from user_profiles v, user_profiles a
       where v.id = (v_row ->> 'vendedor_id')::uuid and a.id = (v_row ->> 'artista_id')::uuid;
    when 'tenant_owners' then
      v_tenant := (v_row ->> 'tenant_id')::uuid;
      v_id := (v_row ->> 'user_id')::uuid;
      select full_name into v_rotulo from user_profiles where id = v_id;
    else
      return null;
  end case;

  if v_tenant is null or not exists (select 1 from tenants where id = v_tenant) then
    return null;
  end if;

  insert into audit_log (tenant_id, ator_id, ator_nome, tabela, operacao, registro_id, rotulo, mudancas)
  values (v_tenant, v_ator, (select full_name from user_profiles where id = v_ator),
          TG_TABLE_NAME, v_op, v_id, v_rotulo, v_mud);
  return null;
end;
$$;

revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
