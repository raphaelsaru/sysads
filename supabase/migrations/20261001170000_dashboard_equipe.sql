-- Métricas por usuário (home do dono, /equipe). Mesmo critério do dashboard_resumo:
-- período por data_mes_venda, leads = pessoas distintas, vendas = negociações 'Venda'.
-- security invoker: RLS decide o escopo (dono/superadmin = empresa).
create or replace function public.dashboard_equipe(p_inicio date, p_fim date)
returns table (user_id uuid, leads bigint, vendas bigint, valor_vendido numeric)
language sql stable security invoker set search_path = public as $$
  select c.user_id,
         count(distinct n.cliente_id) as leads,
         count(*) filter (where n.resultado = 'Venda') as vendas,
         coalesce(sum(n.valor_fechado) filter (where n.resultado = 'Venda'), 0) as valor_vendido
    from public.negociacoes n
    join public.clientes c on c.id = n.cliente_id
   where n.data_mes_venda between p_inicio and p_fim
   group by c.user_id
$$;

revoke execute on function public.dashboard_equipe(date, date) from anon, public;
grant execute on function public.dashboard_equipe(date, date) to authenticated;
