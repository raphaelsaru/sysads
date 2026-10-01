begin;

insert into auth.users (id, email, instance_id, aud, role) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'wh-owner@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into tenants (id, name, slug, max_users, is_active) values
  ('eeeeeeee-1111-0000-0000-000000000000', 'WH', 'wh-teste', 2, true);
update user_profiles set tenant_id = 'eeeeeeee-1111-0000-0000-000000000000', role = 'owner'
  where id = 'eeeeeeee-0000-0000-0000-00000000000a';
insert into clientes (id, user_id, data_contato, nome, whatsapp_instagram, origem) values
  ('eeeeeeee-2222-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000a', '2026-09-01', 'x', '11933330001', 'Anúncio');

do $$
declare n int; r boolean;
begin
  -- 1º contato: cria
  select registrar_negociacao_webhook('eeeeeeee-2222-0000-0000-000000000001', '2026-09-01', 'eeeeeeee-0000-0000-0000-00000000000a', 'msg-1', 30) into r;
  if not r then raise exception 'FALHA 1o contato'; end if;

  -- mensagens seguintes dentro de 30 dias: não cria
  select registrar_negociacao_webhook('eeeeeeee-2222-0000-0000-000000000001', '2026-09-01', 'eeeeeeee-0000-0000-0000-00000000000a', 'msg-2', 30) into r;
  if r then raise exception 'FALHA mesma conversa'; end if;
  select registrar_negociacao_webhook('eeeeeeee-2222-0000-0000-000000000001', '2026-09-30', 'eeeeeeee-0000-0000-0000-00000000000a', 'msg-3', 30) into r;
  if r then raise exception 'FALHA dia 29'; end if;

  -- reentrega da mesma mensagem: não cria nem quebra
  select registrar_negociacao_webhook('eeeeeeee-2222-0000-0000-000000000001', '2026-09-01', 'eeeeeeee-0000-0000-0000-00000000000a', 'msg-1', 30) into r;
  if r then raise exception 'FALHA reentrega'; end if;

  -- retorno após 30 dias da última negociação: cria
  select registrar_negociacao_webhook('eeeeeeee-2222-0000-0000-000000000001', '2026-10-01', 'eeeeeeee-0000-0000-0000-00000000000a', 'msg-4', 30) into r;
  if not r then raise exception 'FALHA retorno 30d'; end if;

  select count(*) into n from negociacoes where cliente_id = 'eeeeeeee-2222-0000-0000-000000000001';
  if n <> 2 then raise exception 'FALHA total: %', n; end if;

  -- só service role executa
  if has_function_privilege('authenticated', 'public.registrar_negociacao_webhook(uuid, date, uuid, text, int)', 'execute')
    then raise exception 'FALHA permissao'; end if;
end $$;

select 'OK' as resultado; -- só chega aqui se nenhum FALHA

rollback;
