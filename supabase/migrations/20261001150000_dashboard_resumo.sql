-- Agrega o dashboard no banco: o cliente baixava as negociações e somava no browser,
-- e o PostgREST corta em 1000 linhas (números errados em meses cheios).
-- security invoker: RLS decide o que o usuário vê (user = próprios leads;
-- owner/superadmin = empresa). p_user_id = "Visualizar como".
-- total = pessoas distintas; demais contadores são por negociação.
create or replace function public.dashboard_resumo(p_inicio date, p_fim date, p_user_id uuid default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with base as (
    select n.cliente_id, n.data_mes_venda as dia, n.resultado, coalesce(n.valor_fechado, 0) as valor,
           n.pagou_sinal, n.venda_paga, n.data_lembrete_chamada
      from public.negociacoes n
      join public.clientes c on c.id = n.cliente_id
     where n.data_mes_venda between p_inicio and p_fim
       and (p_user_id is null or c.user_id = p_user_id)
  ),
  dias as (
    select dia, count(distinct cliente_id) as leads,
           coalesce(sum(valor) filter (where resultado = 'Venda'), 0) as valor
      from base group by dia
  )
  select jsonb_build_object(
    'total',            (select count(distinct cliente_id) from base),
    'vendas',           (select count(*) from base where resultado = 'Venda'),
    'emProcesso',       (select count(*) from base where resultado = 'Orçamento em Processo'),
    'naoVenda',         (select count(*) from base where resultado = 'Não Venda'),
    'valorVendido',     (select coalesce(sum(valor), 0) from base where resultado = 'Venda'),
    'valorEmProcesso',  (select coalesce(sum(valor), 0) from base where resultado = 'Orçamento em Processo'),
    'vendasComSinal',   (select count(*) from base where resultado = 'Venda' and pagou_sinal),
    'vendasPagas',      (select count(*) from base where resultado = 'Venda' and venda_paga),
    'leadsComLembrete', (select count(*) from base where data_lembrete_chamada is not null),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'leads', leads, 'valor', valor) order by dia) from dias), '[]'::jsonb)
  )
$$;

revoke all on function public.dashboard_resumo(date, date, uuid) from public, anon;
grant execute on function public.dashboard_resumo(date, date, uuid) to authenticated;
