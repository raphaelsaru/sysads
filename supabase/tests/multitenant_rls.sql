begin;

-- fixtures (conexão direta = trusted, triggers deixam passar)
insert into auth.users (id, email, instance_id, aud, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'mt-owner-a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'mt-user-a@teste.local',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-00000000000c', 'mt-gestor-a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-00000000000d', 'mt-vendedor-a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'mt-owner-b@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into tenants (id, name, slug, max_users, is_active) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'MT A', 'mt-a-teste', 4, true),
  ('bbbbbbbb-1111-0000-0000-000000000000', 'MT B', 'mt-b-teste', 1, true);

-- handle_new_user já criou user_profiles; ajusta
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'owner' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'user'  where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'gestor'   where id = 'aaaaaaaa-0000-0000-0000-00000000000c';
update user_profiles set tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000', role = 'vendedor' where id = 'aaaaaaaa-0000-0000-0000-00000000000d';
update user_profiles set tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000', role = 'owner' where id = 'bbbbbbbb-0000-0000-0000-00000000000a';

-- owner A também dono de B (vínculo extra; não ocupa slot de B, que tem 1 só)
insert into tenant_owners (tenant_id, user_id) values ('bbbbbbbb-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000000a');

insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', current_date, 'lead owner A', '11911110001', 'Outro'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', current_date, 'lead user A',  '11911110002', 'Outro'),
  ('aaaaaaaa-0000-0000-0000-00000000000d', current_date, 'lead vendedor A', '11911110003', 'Outro'),
  ('bbbbbbbb-0000-0000-0000-00000000000a', current_date, 'lead owner B', '11911110001', 'Outro'); -- mesmo telefone: ok em outra empresa

do $$
declare n int;
begin
  -- slots: B tem 1 slot, já ocupado
  begin
    update user_profiles set tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000' where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
    raise exception 'FALHA: slot deveria bloquear';
  exception when others then
    if sqlerrm not like 'limite de usuarios%' then raise; end if;
  end;

  -- owner A: vê 3 leads e 4 perfis (só empresa A)
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 3 then raise exception 'FALHA owner A viu %', n; end if;
  select count(*) into n from user_profiles; if n <> 4 then raise exception 'FALHA owner A perfis %', n; end if;
  execute 'reset role';

  -- user A: vê só o próprio
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA user A viu %', n; end if;
  begin
    update user_profiles set is_active = false where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
    raise exception 'FALHA: user alterou is_active';
  exception when others then
    if sqlerrm not like 'alteracao de is_active%' then raise; end if;
  end;
  execute 'reset role';

  -- gestor A: vê os 3 leads de A e os perfis da empresa, mas não edita/cria lead alheio
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000c","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 3 then raise exception 'FALHA gestor viu %', n; end if;
  select count(*) into n from user_profiles; if n <> 4 then raise exception 'FALHA gestor perfis %', n; end if;
  update clientes set nome = 'x' where nome = 'lead user A';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FALHA gestor editou lead alheio'; end if;
  begin
    insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem)
    values ('aaaaaaaa-0000-0000-0000-00000000000d', current_date, 'gestor p/ outro', '11911110099', 'Outro');
    raise exception 'FALHA gestor criou lead p/ outro';
  exception when insufficient_privilege then null; -- RLS (42501)
  end;
  execute 'reset role';

  -- vendedor A: só o próprio
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000d","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA vendedor viu %', n; end if;
  select count(*) into n from user_profiles; if n <> 1 then raise exception 'FALHA vendedor perfis %', n; end if;
  execute 'reset role';

  -- owner A visitando B (vínculo): vê só B
  perform set_config('request.jwt.claims', '', true);
  update user_profiles set active_tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA owner A em B viu %', n; end if;
  insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', current_date, 'lead owner A em B', '11911110077', 'Outro');
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update user_profiles set active_tenant_id = null where id = 'aaaaaaaa-0000-0000-0000-00000000000a';

  -- owner B edita lead do dono vinculado (perfil dele não é visível p/ B)
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  update clientes set nome = 'editado por B' where nome = 'lead owner A em B';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALHA owner B nao editou lead do vinculado'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  delete from clientes where nome = 'editado por B';

  -- sem vínculo: active_tenant_id ignorado (vendedor tentando visitar B)
  update user_profiles set active_tenant_id = 'bbbbbbbb-1111-0000-0000-000000000000' where id = 'aaaaaaaa-0000-0000-0000-00000000000d';
  if public.effective_tenant_id('aaaaaaaa-0000-0000-0000-00000000000d') is distinct from 'aaaaaaaa-1111-0000-0000-000000000000'
    then raise exception 'FALHA vendedor escapou p/ B'; end if;
  -- vínculo não ocupa slot: B (1 slot) aceitou owner A vinculado (insert acima sem erro)

  -- owner B: vê 1
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 1 then raise exception 'FALHA owner B viu %', n; end if;
  select count(*) into n from tenants; if n <> 1 then raise exception 'FALHA owner B tenants %', n; end if;
  execute 'reset role';

  -- user A desativado: vê 0
  perform set_config('request.jwt.claims', '', true);
  update user_profiles set is_active = false where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 0 then raise exception 'FALHA inativo viu %', n; end if;
  if public.acesso_crm() <> 'usuario_inativo' then raise exception 'FALHA acesso_crm'; end if;
  execute 'reset role';

  -- empresa B inativa: owner B vê 0
  perform set_config('request.jwt.claims', '', true);
  update tenants set is_active = false where id = 'bbbbbbbb-1111-0000-0000-000000000000';
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 0 then raise exception 'FALHA empresa inativa viu %', n; end if;
  execute 'reset role';

  -- superadmin visitando A: vê 3
  perform set_config('request.jwt.claims', '', true);
  update user_profiles set active_tenant_id = 'aaaaaaaa-1111-0000-0000-000000000000' where id = '32b521df-53ed-433e-97d2-0a18ccda1964';
  perform set_config('request.jwt.claims', '{"sub":"32b521df-53ed-433e-97d2-0a18ccda1964","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from clientes; if n <> 3 then raise exception 'FALHA superadmin em A viu %', n; end if;
  execute 'reset role';

  -- FK RESTRICT: apagar empresa com membros falha
  perform set_config('request.jwt.claims', '', true);
  begin
    delete from tenants where id = 'aaaaaaaa-1111-0000-0000-000000000000';
    raise exception 'FALHA: delete com membros deveria falhar';
  exception when foreign_key_violation then null;
  end;

  raise notice 'OK: todos os checks passaram';
end $$;

select 'OK' as resultado; -- só chega aqui se nenhum FALHA

rollback;
