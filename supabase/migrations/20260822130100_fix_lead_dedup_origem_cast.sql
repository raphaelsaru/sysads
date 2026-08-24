-- `origem` é enum (origem_tipo); cast necessário pro parâmetro text da RPC.
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
