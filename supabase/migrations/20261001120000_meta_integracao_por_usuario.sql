-- Integração Meta por usuário (ex.: tatuadores com conta de anúncio própria)
-- com fallback na integração padrão da empresa (user_id null).

alter table public.meta_integrations
  add column user_id uuid references public.user_profiles(id) on delete cascade,
  drop constraint meta_integrations_tenant_id_key;

create unique index meta_integrations_empresa_uidx
  on public.meta_integrations (tenant_id) where user_id is null;
create unique index meta_integrations_usuario_uidx
  on public.meta_integrations (user_id) where user_id is not null;

-- Dono do lead no momento do evento: define qual integração envia.
alter table public.meta_event_outbox
  add column user_id uuid;

-- Do usuário se existir (ativa ou não), senão a da empresa.
create or replace function public.meta_integracao_efetiva(p_tenant uuid, p_user uuid)
returns setof public.meta_integrations language sql stable security definer set search_path = public as $$
  select * from public.meta_integrations
   where tenant_id = p_tenant and (user_id = p_user or user_id is null)
   order by (user_id is null)
   limit 1
$$;
revoke all on function public.meta_integracao_efetiva(uuid, uuid) from public, anon, authenticated;
grant execute on function public.meta_integracao_efetiva(uuid, uuid) to service_role;

-- Token passa a ser por integração (id), não por tenant.
drop function public.meta_salvar_token(uuid, text);
drop function public.meta_ler_token(uuid);

create or replace function public.meta_salvar_token(p_integracao uuid, p_token text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  select token_secret_id into v_id from public.meta_integrations where id = p_integracao;
  if not found then raise exception 'integracao meta inexistente'; end if;
  if v_id is null then
    v_id := vault.create_secret(p_token, 'meta_token_' || p_integracao::text);
    update public.meta_integrations set token_secret_id = v_id, updated_at = now() where id = p_integracao;
  else
    perform vault.update_secret(v_id, p_token);
    update public.meta_integrations set updated_at = now() where id = p_integracao;
  end if;
end $$;

create or replace function public.meta_ler_token(p_integracao uuid)
returns text language sql security definer set search_path = public, vault as $$
  select s.decrypted_secret
  from public.meta_integrations i
  join vault.decrypted_secrets s on s.id = i.token_secret_id
  where i.id = p_integracao
$$;

revoke all on function public.meta_salvar_token(uuid, text) from public, anon, authenticated;
revoke all on function public.meta_ler_token(uuid) from public, anon, authenticated;
grant execute on function public.meta_salvar_token(uuid, text) to service_role;
grant execute on function public.meta_ler_token(uuid) to service_role;

-- Trigger grava o dono do lead.
create or replace function public.meta_enfileirar_negociacao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_origem text; v_user uuid;
begin
  select c.origem::text, c.user_id into v_origem, v_user from public.clientes c where c.id = new.cliente_id;
  if new.meta_ad_id is null and coalesce(v_origem, '') not like 'Anúncio%' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.meta_event_outbox (tenant_id, user_id, event_name, event_id, entity_type, entity_id, event_time)
    values (new.tenant_id, v_user, 'Contact', 'negociacao:' || new.id || ':contact', 'negociacao', new.id, new.created_at)
    on conflict (tenant_id, event_id) do nothing;
  end if;

  if new.qualidade_contato = 'Bom' or new.orcamento_enviado then
    insert into public.meta_event_outbox (tenant_id, user_id, event_name, event_id, entity_type, entity_id, event_time)
    values (new.tenant_id, v_user, 'Lead', 'negociacao:' || new.id || ':lead', 'negociacao', new.id, now())
    on conflict (tenant_id, event_id) do nothing;
  end if;

  if new.resultado = 'Venda' and coalesce(new.valor_fechado, 0) > 0 then
    insert into public.meta_event_outbox (tenant_id, user_id, event_name, event_id, entity_type, entity_id, event_time, payload)
    values (new.tenant_id, v_user, 'Purchase', 'negociacao:' || new.id || ':purchase', 'negociacao', new.id, now(),
            jsonb_build_object('value', new.valor_fechado))
    on conflict (tenant_id, event_id) do nothing;
  end if;

  return new;
end $$;

-- Claim só pega evento cuja integração efetiva está ativa.
create or replace function public.claim_meta_events(p_limit int default 50)
returns setof public.meta_event_outbox language sql security definer set search_path = public as $$
  update public.meta_event_outbox o
     set status = 'processing', claimed_at = now()
   where o.id in (
     select e.id from public.meta_event_outbox e
     cross join lateral public.meta_integracao_efetiva(e.tenant_id, e.user_id) i
     where i.is_active
       and ((e.status = 'pending' and e.next_attempt_at <= now())
         or (e.status = 'processing' and e.claimed_at < now() - interval '10 minutes'))
     order by e.next_attempt_at
     limit p_limit
     for update of e skip locked
   )
  returning o.*;
$$;
