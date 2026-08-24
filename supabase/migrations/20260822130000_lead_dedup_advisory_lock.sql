-- Corrige duplicação de leads criados via webhook (WAHA/Instagram): condição de corrida
-- entre SELECT (verifica se existe) e INSERT permitia duplicatas quando múltiplos eventos
-- chegavam quase simultâneos pro mesmo contato.
--
-- Não usamos constraint única em (user_id, whatsapp_instagram) porque a equipe cria
-- manualmente leads repetidos pro mesmo contato quando ele volta a falar depois de dias/semanas
-- (fluxo legítimo, sem checagem de duplicata). Uma constraint global bloquearia isso.
-- Em vez disso, usamos advisory lock transacional pra serializar apenas as chamadas
-- concorrentes do webhook pro mesmo (user_id, identificador, origem).

drop index if exists clientes_whatsapp_dedup_anuncio_idx;
drop index if exists clientes_whatsapp_dedup_instagram_idx;

create or replace function public.create_lead_dedup(
  p_user_id uuid,
  p_data_contato date,
  p_nome text,
  p_identificador text,
  p_origem text,
  p_created_by uuid
) returns table(id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || '|' || p_identificador || '|' || p_origem, 0));

  select c.id into v_id from clientes c
  where c.user_id = p_user_id and c.whatsapp_instagram = p_identificador and c.origem = p_origem::origem_tipo
  limit 1;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  insert into clientes (
    user_id, data_contato, nome, whatsapp_instagram, origem,
    orcamento_enviado, resultado, qualidade_contato, nao_respondeu, created_by, updated_by
  ) values (
    p_user_id, p_data_contato, p_nome, p_identificador, p_origem::origem_tipo,
    false, 'Orçamento em Processo', 'Regular', false, p_created_by, p_created_by
  )
  returning clientes.id into v_id;

  return query select v_id, true;
end;
$$;

grant execute on function public.create_lead_dedup(uuid, date, text, text, text, uuid) to service_role;
