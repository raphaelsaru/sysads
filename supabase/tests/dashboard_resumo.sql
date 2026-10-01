begin;

insert into auth.users (id, email, instance_id, aud, role) values
  ('dddddddd-0000-0000-0000-00000000000a', 'db-owner@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-00000000000b', 'db-user@teste.local',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into tenants (id, name, slug, max_users, is_active) values
  ('dddddddd-1111-0000-0000-000000000000', 'DB', 'db-teste', 3, true);
update user_profiles set tenant_id = 'dddddddd-1111-0000-0000-000000000000', role = 'owner' where id = 'dddddddd-0000-0000-0000-00000000000a';
update user_profiles set tenant_id = 'dddddddd-1111-0000-0000-000000000000', role = 'user'  where id = 'dddddddd-0000-0000-0000-00000000000b';

insert into clientes (id, user_id, data_contato, nome, whatsapp_instagram, origem) values
  ('dddddddd-2222-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000b', '2026-09-01', 'a', '11944440001', 'Outro'),
  ('dddddddd-2222-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000b', '2026-09-01', 'b', '11944440002', 'Outro'),
  ('dddddddd-2222-0000-0000-000000000003', 'dddddddd-0000-0000-0000-00000000000a', '2026-09-01', 'c', '11944440003', 'Outro');

-- cliente 1: 2 negociações (1 venda), cliente 2: 1 não venda, cliente 3 (do owner): 1 em processo; uma fora do período
insert into negociacoes (cliente_id, data_contato, resultado, valor_fechado, pagou_sinal, data_pagamento_sinal) values
  ('dddddddd-2222-0000-0000-000000000001', '2026-09-02', 'Orçamento em Processo', 300, false, null),
  ('dddddddd-2222-0000-0000-000000000001', '2026-09-03', 'Venda', 1000, true, '2026-09-05'),
  ('dddddddd-2222-0000-0000-000000000002', '2026-09-02', 'Não Venda', null, false, null),
  ('dddddddd-2222-0000-0000-000000000003', '2026-09-02', 'Orçamento em Processo', 200, false, null),
  ('dddddddd-2222-0000-0000-000000000003', '2026-08-01', 'Venda', 999, false, null);

do $$
declare r jsonb;
begin
  -- owner vê a empresa toda
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  r := dashboard_resumo('2026-09-01', '2026-09-30', null);
  if (r->>'total')::int <> 3 then raise exception 'FALHA total pessoas: %', r->>'total'; end if;
  if (r->>'vendas')::int <> 1 then raise exception 'FALHA vendas: %', r->>'vendas'; end if;
  if (r->>'emProcesso')::int <> 2 then raise exception 'FALHA em processo: %', r->>'emProcesso'; end if;
  if (r->>'naoVenda')::int <> 1 then raise exception 'FALHA nao venda: %', r->>'naoVenda'; end if;
  if (r->>'valorVendido')::numeric <> 1000 then raise exception 'FALHA valor vendido: %', r->>'valorVendido'; end if;
  if (r->>'valorEmProcesso')::numeric <> 500 then raise exception 'FALHA valor processo: %', r->>'valorEmProcesso'; end if;
  if (r->>'vendasComSinal')::int <> 1 then raise exception 'FALHA sinal'; end if;
  -- venda conta no dia do sinal (data_mes_venda); dia 02 tem 3 pessoas distintas
  if (select (d->>'leads')::int from jsonb_array_elements(r->'dias') d where d->>'dia' = '2026-09-02') <> 3
    then raise exception 'FALHA leads dia 02'; end if;
  if (select (d->>'valor')::numeric from jsonb_array_elements(r->'dias') d where d->>'dia' = '2026-09-05') <> 1000
    then raise exception 'FALHA valor dia 05'; end if;

  -- filtro por usuário (Visualizar como)
  r := dashboard_resumo('2026-09-01', '2026-09-30', 'dddddddd-0000-0000-0000-00000000000b');
  if (r->>'total')::int <> 2 then raise exception 'FALHA total filtrado: %', r->>'total'; end if;
  execute 'reset role';

  -- user comum: RLS limita aos próprios leads mesmo sem filtro
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  r := dashboard_resumo('2026-09-01', '2026-09-30', null);
  if (r->>'total')::int <> 2 then raise exception 'FALHA RLS user: %', r->>'total'; end if;
  execute 'reset role';
end $$;

select 'OK' as resultado; -- só chega aqui se nenhum FALHA

rollback;
