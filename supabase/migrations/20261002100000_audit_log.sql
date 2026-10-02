-- Logs de auditoria por empresa (só dono/superadmin leem). Design: docs/plans/2026-10-02-logs-auditoria.md
-- Ator: auth.uid() (navegador) ou header x-prizely-ator (rotas de servidor c/ service role).
-- Sem ator = ação automática (webhook, cron) → não registra.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade, -- empresa excluída leva os logs
  ator_id uuid,
  ator_nome text,
  tabela text not null,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id uuid,
  rotulo text,
  mudancas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_tenant_data_idx on public.audit_log (tenant_id, created_at desc, id desc);
create index if not exists audit_log_tenant_ator_idx on public.audit_log (tenant_id, ator_id, created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select using (
  tenant_id = (select public.current_tenant_id()) and (select public.is_tenant_owner())
);

-- TG_ARGV = campos auditados da tabela.
create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_ator uuid := auth.uid();
  v_old jsonb := case when TG_OP <> 'INSERT' then to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP <> 'DELETE' then to_jsonb(NEW) end;
  v_row jsonb;
  v_mud jsonb := '{}'::jsonb;
  v_tenant uuid;
  v_id uuid;
  v_rotulo text;
  c text;
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
          TG_TABLE_NAME, TG_OP, v_id, v_rotulo, v_mud);
  return null;
end;
$$;

revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

drop trigger if exists auditoria on public.clientes;
create trigger auditoria after insert or update or delete on public.clientes
  for each row execute function public.registrar_auditoria(
    'nome', 'whatsapp_instagram', 'email', 'origem', 'observacao', 'categoria', 'user_id', 'data_contato');

drop trigger if exists auditoria on public.negociacoes;
create trigger auditoria after insert or update or delete on public.negociacoes
  for each row execute function public.registrar_auditoria(
    'data_contato', 'resultado', 'valor_fechado', 'orcamento_enviado', 'qualidade_contato', 'nao_respondeu',
    'pagou_sinal', 'valor_sinal', 'data_pagamento_sinal', 'venda_paga', 'data_pagamento_venda',
    'data_lembrete_chamada', 'observacao');

drop trigger if exists auditoria on public.follow_ups;
create trigger auditoria after insert or update or delete on public.follow_ups
  for each row execute function public.registrar_auditoria('observacao', 'respondeu');

drop trigger if exists auditoria on public.user_profiles;
create trigger auditoria after insert or update or delete on public.user_profiles
  for each row execute function public.registrar_auditoria('role', 'is_active', 'full_name');

drop trigger if exists auditoria on public.tenants;
create trigger auditoria after insert or update on public.tenants
  for each row execute function public.registrar_auditoria('name', 'branding', 'max_users', 'is_active');

drop trigger if exists auditoria on public.vendedor_artistas;
create trigger auditoria after insert or delete on public.vendedor_artistas
  for each row execute function public.registrar_auditoria('artista_id');

drop trigger if exists auditoria on public.tenant_owners;
create trigger auditoria after insert or delete on public.tenant_owners
  for each row execute function public.registrar_auditoria('user_id');

-- Retenção: 12 meses
select cron.unschedule('audit-log-retencao') where exists (select 1 from cron.job where jobname = 'audit-log-retencao');
select cron.schedule('audit-log-retencao', '15 6 * * *',
  $job$delete from public.audit_log where created_at < now() - interval '12 months'$job$);
