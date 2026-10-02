-- Trava de exclusão: só superadmin (ou contexto confiável: service role/SQL direto) apaga de verdade.
-- Demais usuários: DELETE vira soft delete (deleted_at/deleted_by) num gatilho BEFORE DELETE;
-- o registro some do app (RLS filtra deleted_at) mas fica no banco.
-- Lead excluído que volta a chamar no WhatsApp vira lead novo (índices únicos ignoram excluídos).

alter table public.clientes    add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.negociacoes add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.follow_ups  add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;

-- Dedup só entre leads ativos
drop index if exists public.clientes_tenant_telefone_normalizado_uidx;
create unique index clientes_tenant_telefone_normalizado_uidx on public.clientes (tenant_id, telefone_normalizado)
  where telefone_normalizado is not null and deleted_at is null;
drop index if exists public.clientes_tenant_instagram_normalizado_uidx;
create unique index clientes_tenant_instagram_normalizado_uidx on public.clientes (tenant_id, instagram_normalizado)
  where instagram_normalizado is not null and deleted_at is null;

create or replace function public.excluir_com_trava()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.is_superadmin() or public.is_trusted_context() then
    return OLD; -- exclusão definitiva
  end if;
  execute format('update public.%I set deleted_at = now(), deleted_by = $1 where id = $2 and deleted_at is null', TG_TABLE_NAME)
    using auth.uid(), OLD.id;
  return null; -- cancela o DELETE
end;
$$;
revoke execute on function public.excluir_com_trava() from public, anon, authenticated;

drop trigger if exists trava_exclusao on public.clientes;
create trigger trava_exclusao before delete on public.clientes for each row execute function public.excluir_com_trava();
drop trigger if exists trava_exclusao on public.negociacoes;
create trigger trava_exclusao before delete on public.negociacoes for each row execute function public.excluir_com_trava();
drop trigger if exists trava_exclusao on public.follow_ups;
create trigger trava_exclusao before delete on public.follow_ups for each row execute function public.excluir_com_trava();

-- RLS: excluídos somem (e filhos de lead excluído também)
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select using (
  deleted_at is null and tenant_id = (select public.current_tenant_id()) and public.pode_ver_lead(user_id)
);
drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update
  using (deleted_at is null and tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(user_id))
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.pode_operar_lead(user_id)
    and public.responsavel_valido(user_id, tenant_id)
  );
drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes for delete using (
  deleted_at is null and tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(user_id)
);

drop policy if exists negociacoes_select on public.negociacoes;
create policy negociacoes_select on public.negociacoes for select using (
  negociacoes.deleted_at is null and exists (
    select 1 from clientes c where c.id = negociacoes.cliente_id and c.deleted_at is null
       and c.tenant_id = (select public.current_tenant_id()) and public.pode_ver_lead(c.user_id))
);
drop policy if exists negociacoes_insert on public.negociacoes;
create policy negociacoes_insert on public.negociacoes for insert with check (
  exists (select 1 from clientes c where c.id = negociacoes.cliente_id and c.deleted_at is null
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);
drop policy if exists negociacoes_update on public.negociacoes;
create policy negociacoes_update on public.negociacoes for update using (
  negociacoes.deleted_at is null and exists (
    select 1 from clientes c where c.id = negociacoes.cliente_id and c.deleted_at is null
       and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);
drop policy if exists negociacoes_delete on public.negociacoes;
create policy negociacoes_delete on public.negociacoes for delete using (
  negociacoes.deleted_at is null and exists (
    select 1 from clientes c where c.id = negociacoes.cliente_id and c.deleted_at is null
       and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);

drop policy if exists follow_ups_select on public.follow_ups;
create policy follow_ups_select on public.follow_ups for select using (
  follow_ups.deleted_at is null and exists (
    select 1 from clientes c where c.id = follow_ups.cliente_id and c.deleted_at is null
       and c.tenant_id = (select public.current_tenant_id()) and public.pode_ver_lead(c.user_id))
);
drop policy if exists follow_ups_insert on public.follow_ups;
create policy follow_ups_insert on public.follow_ups for insert with check (
  exists (select 1 from clientes c where c.id = follow_ups.cliente_id and c.deleted_at is null
           and c.tenant_id = (select public.current_tenant_id()) and public.pode_operar_lead(c.user_id))
);
drop policy if exists follow_ups_delete on public.follow_ups;
create policy follow_ups_delete on public.follow_ups for delete using (
  deleted_at is null and tenant_id = (select public.current_tenant_id())
  and (created_by = (select auth.uid()) or (select public.is_tenant_owner()))
);

-- Webhook WhatsApp e dedup ignoram excluídos
do $$
declare
  v_def text := pg_get_functiondef('public.find_or_create_cliente(uuid,date,text,text,text,uuid)'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def, 'c.instagram_normalizado = v_insta))', 'c.instagram_normalizado = v_insta)) and c.deleted_at is null');
  if (length(v_novo) - length(v_def)) <> 2 * length(' and c.deleted_at is null') then
    raise exception 'find_or_create_cliente mudou; ajustar migration';
  end if;
  execute v_novo;

  v_def := pg_get_functiondef('public.registrar_negociacao_webhook(uuid,date,uuid,text,integer)'::regprocedure);
  v_novo := replace(v_def, 'and data_contato > p_data_contato - p_janela_dias', 'and data_contato > p_data_contato - p_janela_dias and deleted_at is null');
  if v_novo = v_def then raise exception 'registrar_negociacao_webhook mudou; ajustar migration'; end if;
  execute v_novo;

  -- Meta CAPI: inativar negociação não gera evento
  v_def := pg_get_functiondef('public.meta_enfileirar_negociacao()'::regprocedure);
  v_novo := regexp_replace(v_def, '\mbegin\M', E'begin\n  if new.deleted_at is not null then return new; end if;');
  if v_novo = v_def then raise exception 'meta_enfileirar_negociacao mudou; ajustar migration'; end if;
  execute v_novo;
end $$;

-- Auditoria: inativação registra como exclusão
do $$
declare
  v_def text := pg_get_functiondef('public.registrar_auditoria()'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
    E'  v_row := coalesce(v_new, v_old);\n',
    E'  v_row := coalesce(v_new, v_old);\n\n'
    || E'  -- soft delete (deleted_at preenchido) conta como exclusão\n'
    || E'  if TG_OP = ''UPDATE'' and v_old ? ''deleted_at'' and (v_old ->> ''deleted_at'') is null and (v_new ->> ''deleted_at'') is not null then\n'
    || E'    v_soft := true;\n'
    || E'  end if;\n');
  v_novo := replace(v_novo, E'  c text;\nbegin', E'  c text;\n  v_soft boolean := false;\nbegin');
  v_novo := replace(v_novo, E'  foreach c in array TG_ARGV loop', E'  foreach c in array case when v_soft then ''{}''::text[] else TG_ARGV end loop');
  v_novo := replace(v_novo, E'  if TG_OP = ''UPDATE'' and v_mud = ''{}''::jsonb then', E'  if TG_OP = ''UPDATE'' and not v_soft and v_mud = ''{}''::jsonb then');
  v_novo := replace(v_novo, E'TG_TABLE_NAME, TG_OP, v_id, v_rotulo, v_mud);', E'TG_TABLE_NAME, case when v_soft then ''DELETE'' else TG_OP end, v_id, v_rotulo, v_mud);');
  if v_novo = v_def or position('v_soft boolean' in v_novo) = 0 or position('case when v_soft then ''DELETE''' in v_novo) = 0
     or position('not v_soft and v_mud' in v_novo) = 0 or position('when v_soft then ''{}''' in v_novo) = 0 then
    raise exception 'registrar_auditoria mudou; ajustar migration';
  end if;
  execute v_novo;
end $$;
