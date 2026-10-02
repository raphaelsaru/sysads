begin;

-- fixtures (sem JWT = automático: não gera log)
insert into auth.users (id, email, instance_id, aud, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'al-owner-a@teste.local',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'al-artista-a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-00000000000c', 'al-gestor-a@teste.local',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'al-owner-b@teste.local',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into tenants (id, name, slug, max_users, is_active) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'AL A', 'al-a-teste', 5, true),
  ('bbbbbbbb-1111-0000-0000-000000000000', 'AL B', 'al-b-teste', 5, true);
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'owner',  full_name = 'Dono A'    where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'user',   full_name = 'Artista A' where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'gestor', full_name = 'Gestor A'  where id = 'aaaaaaaa-0000-0000-0000-00000000000c';
update user_profiles set tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000', role = 'owner',  full_name = 'Dono B'    where id = 'bbbbbbbb-0000-0000-0000-00000000000a';

do $$
declare n int; r record;
begin
  select count(*) into n from audit_log where tenant_id in ('aaaaaaaa-1111-0000-0000-000000000000', 'bbbbbbbb-1111-0000-0000-000000000000');
  if n <> 0 then raise exception 'FALHA fixtures sem ator geraram % logs', n; end if;

  -- artista cria lead e negociação; altera nome; "altera" campo sem mudança
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem)
  values ('aaaaaaaa-0000-0000-0000-00000000000b', current_date, 'Joao', '11922220001', 'Outro');
  insert into negociacoes (cliente_id, data_contato, resultado, valor_fechado)
  select id, current_date, 'Venda', 500 from clientes where nome = 'Joao';
  update clientes set nome = 'Joao Silva' where nome = 'Joao';
  update clientes set observacao = observacao where nome = 'Joao Silva';
  update negociacoes set valor_fechado = 800 where cliente_id = (select id from clientes where nome = 'Joao Silva');
  begin
    insert into audit_log (tenant_id, tabela, operacao) values ('aaaaaaaa-1111-0000-0000-000000000000', 'x', 'INSERT');
    raise exception 'FALHA authenticated inseriu log';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from audit_log; if n <> 0 then raise exception 'FALHA artista viu % logs', n; end if;
  execute 'reset role';

  select count(*) into n from audit_log where tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000';
  if n <> 4 then raise exception 'FALHA esperado 4 logs (insert cliente, insert neg, update nome, update valor), veio %', n; end if;

  select * into r from audit_log where tabela = 'clientes' and operacao = 'UPDATE' and tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000';
  if r.ator_nome <> 'Artista A' or r.mudancas -> 'nome' <> '["Joao", "Joao Silva"]'::jsonb or r.rotulo <> 'Joao Silva' then
    raise exception 'FALHA conteudo update cliente: % %', r.ator_nome, r.mudancas;
  end if;
  select * into r from audit_log where tabela = 'negociacoes' and operacao = 'UPDATE' and tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000';
  if r.mudancas -> 'valor_fechado' <> '[500, 800]'::jsonb or r.rotulo <> 'Joao Silva' then
    raise exception 'FALHA conteudo update negociacao: %', r.mudancas;
  end if;

  -- service role sem header (webhook): não registra
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.headers', '{}', true);
  update clientes set nome = 'Joao S.' where nome = 'Joao Silva';
  select count(*) into n from audit_log where tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000';
  if n <> 4 then raise exception 'FALHA automatico gerou log'; end if;

  -- service role c/ header de ator (rota do dono): registra c/ o dono
  perform set_config('request.headers', '{"x-prizely-ator":"aaaaaaaa-0000-0000-0000-00000000000a"}', true);
  update user_profiles set role = 'vendedor' where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
  select * into r from audit_log where tabela = 'user_profiles' and tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000';
  if r.ator_nome <> 'Dono A' or r.mudancas -> 'role' <> '["user", "vendedor"]'::jsonb then
    raise exception 'FALHA log c/ header: % %', r.ator_nome, r.mudancas;
  end if;
  perform set_config('request.headers', '{}', true);
  perform set_config('request.jwt.claims', '', true);

  -- leitura: dono A vê 5; gestor A e dono B não veem
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from audit_log; if n <> 5 then raise exception 'FALHA dono A viu %', n; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000c","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from audit_log; if n <> 0 then raise exception 'FALHA gestor viu %', n; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from audit_log; if n <> 0 then raise exception 'FALHA dono B viu %', n; end if;
  execute 'reset role';

  -- excluir cliente: 1 log (negociações em cascata não duplicam)
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  delete from clientes where nome = 'Joao S.';
  execute 'reset role';
  select count(*) into n from audit_log where tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000' and operacao = 'DELETE';
  if n <> 1 then raise exception 'FALHA delete gerou % logs', n; end if;
end $$;

select 'OK' as resultado;

rollback;
