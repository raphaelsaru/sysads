begin;

insert into auth.users (id, email, instance_id, aud, role) values
  ('f0000000-0000-0000-0000-00000000000a', 'sd-dono@teste.local',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('f0000000-0000-0000-0000-00000000000b', 'sd-artista@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into tenants (id, name, slug, max_users, is_active) values ('f0000000-1111-0000-0000-000000000000', 'SD', 'sd-teste', 5, true);
update user_profiles set tenant_id = 'f0000000-1111-0000-0000-000000000000', role = 'owner', full_name = 'Dono SD' where id = 'f0000000-0000-0000-0000-00000000000a';
update user_profiles set tenant_id = 'f0000000-1111-0000-0000-000000000000', role = 'user',  full_name = 'Artista SD' where id = 'f0000000-0000-0000-0000-00000000000b';
insert into clientes (id, user_id, data_contato, nome, whatsapp_instagram, origem) values
  ('f0000000-2222-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000b', current_date, 'Lead 1', '11933330001', 'Outro'),
  ('f0000000-2222-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000b', current_date, 'Lead 2', '11933330002', 'Outro');
insert into negociacoes (id, cliente_id, data_contato, resultado, valor_fechado) values
  ('f0000000-3333-0000-0000-000000000001', 'f0000000-2222-0000-0000-000000000001', current_date, 'Venda', 100),
  ('f0000000-3333-0000-0000-000000000002', 'f0000000-2222-0000-0000-000000000002', current_date, 'Venda', 200);

do $$
declare n int;
begin
  -- artista "exclui" lead 1 e negociação do lead 2: somem p/ ele, ficam no banco
  perform set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  delete from clientes where id = 'f0000000-2222-0000-0000-000000000001';
  delete from negociacoes where id = 'f0000000-3333-0000-0000-000000000002';
  select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA artista ve % leads', n; end if;
  select count(*) into n from negociacoes; if n <> 0 then raise exception 'FALHA artista ve % negociacoes', n; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  select count(*) into n from clientes where id = 'f0000000-2222-0000-0000-000000000001' and deleted_at is not null and deleted_by = 'f0000000-0000-0000-0000-00000000000b';
  if n <> 1 then raise exception 'FALHA lead nao ficou inativado no banco'; end if;
  select count(*) into n from negociacoes where cliente_id = 'f0000000-2222-0000-0000-000000000001' and deleted_at is null;
  if n <> 1 then raise exception 'FALHA negociacao do lead excluido sumiu do banco'; end if;
  select count(*) into n from negociacoes where id = 'f0000000-3333-0000-0000-000000000002' and deleted_at is not null;
  if n <> 1 then raise exception 'FALHA negociacao nao inativada'; end if;

  -- dono também só inativa
  perform set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  delete from clientes where id = 'f0000000-2222-0000-0000-000000000002';
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from clientes where tenant_id = 'f0000000-1111-0000-0000-000000000000';
  if n <> 2 then raise exception 'FALHA dono apagou de verdade'; end if;

  -- auditoria registra como exclusão
  select count(*) into n from audit_log where tenant_id = 'f0000000-1111-0000-0000-000000000000' and operacao = 'DELETE';
  if n <> 3 then raise exception 'FALHA auditoria: % exclusoes', n; end if;

  -- mesmo telefone volta (webhook): lead novo
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select count(*) into n from find_or_create_cliente('f0000000-0000-0000-0000-00000000000b', current_date, 'Lead 1 de novo', '11933330001', 'Anúncio', 'f0000000-0000-0000-0000-00000000000b') where created;
  if n <> 1 then raise exception 'FALHA lead excluido nao virou lead novo'; end if;

  -- contexto confiável (service role) apaga de verdade
  delete from clientes where id = 'f0000000-2222-0000-0000-000000000002';
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from clientes where id = 'f0000000-2222-0000-0000-000000000002';
  if n <> 0 then raise exception 'FALHA service role nao apagou'; end if;
end $$;

-- superadmin apaga de verdade
do $$
declare v_sa uuid; n int;
begin
  select id into v_sa from user_profiles where role = 'admin' and is_active limit 1;
  update user_profiles set active_tenant_id = 'f0000000-1111-0000-0000-000000000000' where id = v_sa;
  insert into clientes (id, user_id, tenant_id, data_contato, nome, whatsapp_instagram, origem)
  values ('f0000000-2222-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000000b', 'f0000000-1111-0000-0000-000000000000', current_date, 'Lead SA', '11933330009', 'Outro');
  perform set_config('request.jwt.claims', json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  delete from clientes where id = 'f0000000-2222-0000-0000-000000000009';
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from clientes where id = 'f0000000-2222-0000-0000-000000000009';
  if n <> 0 then raise exception 'FALHA superadmin nao apagou de verdade'; end if;
end $$;

select 'OK' as resultado;

rollback;
