-- Preset "planilha": campos/opções extras p/ empresas vindas de CRM em planilha
-- (DNA4, Concept Studio, Travizan Midias). null = padrão Prizely.
-- Design: docs/plans/2026-10-03-crm-preset-planilha-design.md

alter type public.origem_tipo add value if not exists 'TikTok';
alter type public.origem_tipo add value if not exists 'WhatsApp Studio';
alter type public.origem_tipo add value if not exists 'Cliente ativo';
alter type public.origem_tipo add value if not exists 'Cliente de Porta';

alter table public.tenants
  add column if not exists crm_preset text check (crm_preset in ('planilha'));

alter table public.negociacoes
  add column if not exists procedimento text,
  add column if not exists motivo_nao_venda text,
  add column if not exists forma_pagamento_sinal text;

drop trigger if exists auditoria on public.negociacoes;
create trigger auditoria after insert or delete or update on public.negociacoes
  for each row execute function public.registrar_auditoria(
    'data_contato', 'resultado', 'valor_fechado', 'orcamento_enviado', 'qualidade_contato',
    'nao_respondeu', 'pagou_sinal', 'valor_sinal', 'data_pagamento_sinal', 'venda_paga',
    'data_pagamento_venda', 'data_lembrete_chamada', 'observacao',
    'procedimento', 'motivo_nao_venda', 'forma_pagamento_sinal');

-- Resultados do preset: Formulário/Consulta Presencial = em processo; Cancelado = não venda.
-- procedimentos/motivos = contagem por negociação no período (motivo só fora de Venda).
create or replace function public.dashboard_resumo(p_inicio date, p_fim date, p_user_id uuid default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with base as (
    select n.cliente_id, n.data_mes_venda as dia, n.resultado, coalesce(n.valor_fechado, 0) as valor,
           n.pagou_sinal, n.venda_paga, n.data_lembrete_chamada,
           nullif(btrim(n.procedimento), '') as procedimento,
           nullif(btrim(n.motivo_nao_venda), '') as motivo,
           n.resultado in ('Orçamento em Processo', 'Formulário', 'Consulta Presencial') as em_processo
      from public.negociacoes n
      join public.clientes c on c.id = n.cliente_id
     where n.data_mes_venda between p_inicio and p_fim
       and (p_user_id is null or c.user_id = p_user_id)
  ),
  dias as (
    select dia, count(distinct cliente_id) as leads,
           coalesce(sum(valor) filter (where resultado = 'Venda'), 0) as valor
      from base group by dia
  ),
  procs as (
    select procedimento as nome, count(*) as qtd from base where procedimento is not null group by 1
  ),
  motivos as (
    select motivo as nome, count(*) as qtd from base where motivo is not null and resultado <> 'Venda' group by 1
  )
  select jsonb_build_object(
    'total',            (select count(distinct cliente_id) from base),
    'vendas',           (select count(*) from base where resultado = 'Venda'),
    'emProcesso',       (select count(*) from base where em_processo),
    'naoVenda',         (select count(*) from base where resultado in ('Não Venda', 'Cancelado')),
    'valorVendido',     (select coalesce(sum(valor), 0) from base where resultado = 'Venda'),
    'valorEmProcesso',  (select coalesce(sum(valor), 0) from base where em_processo),
    'vendasComSinal',   (select count(*) from base where resultado = 'Venda' and pagou_sinal),
    'vendasPagas',      (select count(*) from base where resultado = 'Venda' and venda_paga),
    'leadsComLembrete', (select count(*) from base where data_lembrete_chamada is not null),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'leads', leads, 'valor', valor) order by dia) from dias), '[]'::jsonb),
    'procedimentos', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'qtd', qtd) order by qtd desc, nome) from procs), '[]'::jsonb),
    'motivos', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'qtd', qtd) order by qtd desc, nome) from motivos), '[]'::jsonb)
  )
$$;

revoke all on function public.dashboard_resumo(date, date, uuid) from public, anon;
grant execute on function public.dashboard_resumo(date, date, uuid) to authenticated;

update public.tenants set crm_preset = 'planilha'
 where id in ('b349d6b0-bce8-486c-94d5-f97e314091c0',  -- DNA4
              'e10cc53b-67e7-4df3-8780-26465fb127ce',  -- Concept Studio
              '47bb24d1-bdce-40fb-965e-66d77714ed29'); -- Travizan Midias
