begin;

-- A: dono1 + artista + vendedor (atende artista); B: dono B
insert into auth.users (id, email, instance_id, aud, role) values
  ('dddddddd-0000-0000-0000-00000000000a', 'vd-dono1@teste.local',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-00000000000b', 'vd-artista@teste.local',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-00000000000c', 'vd-vendedor@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('eeeeeeee-0000-0000-0000-00000000000a', 'vd-donob@teste.local',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into tenants (id, name, slug, max_users, is_active) values
  ('dddddddd-1111-0000-0000-000000000000', 'VD A', 'vd-a-teste', 5, true),
  ('eeeeeeee-1111-0000-0000-000000000000', 'VD B', 'vd-b-teste', 5, true);
update user_profiles set tenant_id = 'dddddddd-1111-0000-0000-000000000000', role = 'owner'    where id = 'dddddddd-0000-0000-0000-00000000000a';
update user_profiles set tenant_id = 'dddddddd-1111-0000-0000-000000000000', role = 'user'     where id = 'dddddddd-0000-0000-0000-00000000000b';
update user_profiles set tenant_id = 'dddddddd-1111-0000-0000-000000000000', role = 'vendedor' where id = 'dddddddd-0000-0000-0000-00000000000c';
update user_profiles set tenant_id = 'eeeeeeee-1111-0000-0000-000000000000', role = 'owner'    where id = 'eeeeeeee-0000-0000-0000-00000000000a';
insert into vendedor_artistas (tenant_id, vendedor_id, artista_id)
values ('dddddddd-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000c', 'dddddddd-0000-0000-0000-00000000000b');

do $$
declare r text; n int;
begin
  -- último dono não sai
  begin
    perform remover_dono('dddddddd-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000a');
    raise exception 'FALHA removeu ultimo dono';
  exception when others then if sqlerrm <> 'ultimo dono' then raise; end if;
  end;

  -- vendedor vira 2º dono de A sem rebaixar o 1º; vínculos de vendedor somem
  r := adicionar_dono('dddddddd-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000c');
  if r <> 'promovido' then raise exception 'FALHA promover: %', r; end if;
  select count(*) into n from user_profiles where tenant_id = 'dddddddd-1111-0000-0000-000000000000' and role = 'owner';
  if n <> 2 then raise exception 'FALHA esperado 2 donos membros, veio %', n; end if;
  select count(*) into n from vendedor_artistas where vendedor_id = 'dddddddd-0000-0000-0000-00000000000c';
  if n <> 0 then raise exception 'FALHA vinculos de vendedor ficaram'; end if;

  -- dono B vira dono de A também (vínculo); A tem 3 donos
  r := adicionar_dono('dddddddd-1111-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-00000000000a');
  if r <> 'vinculado' then raise exception 'FALHA vincular: %', r; end if;
  if contar_donos_ativos('dddddddd-1111-0000-0000-000000000000') <> 3 then raise exception 'FALHA contagem'; end if;

  -- duplicado e artista de outra empresa recusados
  begin
    perform adicionar_dono('dddddddd-1111-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-00000000000a');
    raise exception 'FALHA duplicou';
  exception when others then if sqlerrm <> 'ja e dono' then raise; end if;
  end;
  begin
    perform adicionar_dono('eeeeeeee-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000b');
    raise exception 'FALHA artista virou dono de outra empresa';
  exception when others then if sqlerrm <> 'usuario de outra empresa nao e dono' then raise; end if;
  end;

  -- dono B não pode ser rebaixado em B enquanto for dono vinculado de A? (B tem 1 dono: ultimo dono)
  begin
    perform remover_dono('eeeeeeee-1111-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-00000000000a');
    raise exception 'FALHA removeu ultimo dono de B';
  exception when others then if sqlerrm <> 'ultimo dono' then raise; end if;
  end;

  -- remove vínculo e rebaixa membro; ainda sobra 1 dono
  r := remover_dono('dddddddd-1111-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-00000000000a');
  if r <> 'desvinculado' then raise exception 'FALHA desvincular: %', r; end if;
  r := remover_dono('dddddddd-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000c');
  if r <> 'rebaixado' then raise exception 'FALHA rebaixar: %', r; end if;
  if (select role from user_profiles where id = 'dddddddd-0000-0000-0000-00000000000c') <> 'user' then
    raise exception 'FALHA rebaixado nao virou artista';
  end if;
  if contar_donos_ativos('dddddddd-1111-0000-0000-000000000000') <> 1 then raise exception 'FALHA contagem final'; end if;

  -- membro que é dono vinculado em outra empresa não pode ser rebaixado
  perform adicionar_dono('eeeeeeee-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000a');
  perform adicionar_dono('dddddddd-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000b');
  begin
    perform remover_dono('dddddddd-1111-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000000a');
    raise exception 'FALHA rebaixou dono com vinculos';
  exception when others then if sqlerrm <> 'dono de outras empresas' then raise; end if;
  end;
end $$;

select 'OK' as resultado;

rollback;
