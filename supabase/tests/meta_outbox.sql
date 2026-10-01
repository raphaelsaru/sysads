begin;

insert into auth.users (id, email, instance_id, aud, role) values
  ('cccccccc-0000-0000-0000-00000000000a', 'meta-owner-c@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into tenants (id, name, slug, max_users, is_active) values
  ('cccccccc-1111-0000-0000-000000000000', 'Meta C', 'meta-c-teste', 2, true);
update user_profiles set tenant_id = 'cccccccc-1111-0000-0000-000000000000', role = 'owner'
  where id = 'cccccccc-0000-0000-0000-00000000000a';

insert into clientes (id, user_id, data_contato, nome, whatsapp_instagram, origem) values
  ('cccccccc-2222-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000a', current_date, 'ad', '11922220001', 'Anúncio'),
  ('cccccccc-2222-0000-0000-000000000002', 'cccccccc-0000-0000-0000-00000000000a', current_date, 'org', '11922220002', 'Indicação'),
  ('cccccccc-2222-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000a', current_date, 'ig', '@igad', 'Instagram');

do $$
declare
  n int;
  v_ad uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_ig uuid := gen_random_uuid();
  v_igorg uuid := gen_random_uuid();
begin
  insert into negociacoes (id, cliente_id, data_contato) values
    (v_ad,    'cccccccc-2222-0000-0000-000000000001', current_date),
    (v_org,   'cccccccc-2222-0000-0000-000000000002', current_date),
    (v_igorg, 'cccccccc-2222-0000-0000-000000000003', current_date);
  insert into negociacoes (id, cliente_id, data_contato, meta_ad_id) values
    (v_ig, 'cccccccc-2222-0000-0000-000000000003', current_date, '123');

  -- Contact só p/ elegíveis (origem Anúncio* ou meta_ad_id)
  select count(*) into n from meta_event_outbox where event_name = 'Contact'
    and tenant_id = 'cccccccc-1111-0000-0000-000000000000';
  if n <> 2 then raise exception 'FALHA contact: %', n; end if;

  -- Lead por orçamento, uma vez só mesmo com Bom depois
  update negociacoes set orcamento_enviado = true where id = v_ad;
  update negociacoes set qualidade_contato = 'Bom' where id = v_ad;
  select count(*) into n from meta_event_outbox where event_id = 'negociacao:' || v_ad || ':lead';
  if n <> 1 then raise exception 'FALHA lead: %', n; end if;

  -- não elegível nunca gera
  update negociacoes set qualidade_contato = 'Bom', resultado = 'Venda', valor_fechado = 100 where id = v_org;
  select count(*) into n from meta_event_outbox where entity_id = v_org;
  if n <> 0 then raise exception 'FALHA nao elegivel: %', n; end if;

  -- Purchase espera valor
  update negociacoes set resultado = 'Venda' where id = v_ig;
  select count(*) into n from meta_event_outbox where event_id = 'negociacao:' || v_ig || ':purchase';
  if n <> 0 then raise exception 'FALHA purchase sem valor'; end if;
  update negociacoes set valor_fechado = 2500 where id = v_ig;
  update negociacoes set valor_fechado = 2600 where id = v_ig;
  select count(*) into n from meta_event_outbox where event_id = 'negociacao:' || v_ig || ':purchase'
    and (payload->>'value')::numeric = 2500;
  if n <> 1 then raise exception 'FALHA purchase: %', n; end if;

  -- authenticated não lê outbox
  perform set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    perform 1 from meta_event_outbox;
    raise exception 'FALHA: authenticated leu outbox';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- outbox guarda o dono do lead
  select count(*) into n from meta_event_outbox
   where tenant_id = 'cccccccc-1111-0000-0000-000000000000' and user_id is distinct from 'cccccccc-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'FALHA user_id: %', n; end if;

  -- claim só pega evento com integração efetiva ativa
  select count(*) into n from claim_meta_events(50);
  if n <> 0 then raise exception 'FALHA claim sem integracao: %', n; end if;

  -- integração do usuário (inativa) tem precedência sobre a da empresa (ativa)
  insert into meta_integrations (tenant_id, dataset_id, is_active) values ('cccccccc-1111-0000-0000-000000000000', 'ds-empresa', true);
  insert into meta_integrations (tenant_id, user_id, dataset_id, is_active)
    values ('cccccccc-1111-0000-0000-000000000000', 'cccccccc-0000-0000-0000-00000000000a', 'ds-user', false);
  if (select dataset_id from meta_integracao_efetiva('cccccccc-1111-0000-0000-000000000000', 'cccccccc-0000-0000-0000-00000000000a')) <> 'ds-user'
    then raise exception 'FALHA efetiva usuario'; end if;
  if (select dataset_id from meta_integracao_efetiva('cccccccc-1111-0000-0000-000000000000', gen_random_uuid())) <> 'ds-empresa'
    then raise exception 'FALHA efetiva empresa'; end if;
  select count(*) into n from claim_meta_events(50) c where c.tenant_id = 'cccccccc-1111-0000-0000-000000000000';
  if n <> 0 then raise exception 'FALHA claim com integracao do usuario inativa: %', n; end if;

  update meta_integrations set is_active = true where user_id = 'cccccccc-0000-0000-0000-00000000000a';
  select count(*) into n from claim_meta_events(50) c where c.tenant_id = 'cccccccc-1111-0000-0000-000000000000';
  if n <> 4 then raise exception 'FALHA claim: %', n; end if; -- 2 contact + 1 lead + 1 purchase
  select count(*) into n from claim_meta_events(50) c where c.tenant_id = 'cccccccc-1111-0000-0000-000000000000';
  if n <> 0 then raise exception 'FALHA reclaim: %', n; end if;

  raise notice 'OK meta_outbox';
end $$;

select 'OK' as resultado; -- só chega aqui se nenhum FALHA

rollback;
