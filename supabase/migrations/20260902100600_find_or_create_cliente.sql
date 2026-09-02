-- Task 0.7: find_or_create_cliente substitui create_lead_dedup.
-- Dedup agora e global (indices unicos de telefone/instagram_normalizado nao sao
-- mais escopados por user_id, ver 20260902100501). A busca abaixo NAO filtra por
-- user_id: um lead ja cadastrado por outro vendedor precisa ser encontrado aqui,
-- senao o INSERT abaixo colide com o indice unico global em vez de retornar o
-- registro existente. O lock de concorrencia continua chaveado por p_user_id +
-- identificador: isso so define o escopo do lock (evita corrida entre chamadas
-- concorrentes do mesmo vendedor pro mesmo identificador), nao filtra dados; nao
-- ha necessidade de torna-lo global pois o SELECT + INSERT abaixo, protegido por
-- este lock, ja e suficiente para nao duplicar entre vendedores diferentes.
create or replace function public.find_or_create_cliente(
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
  v_tel text := public.normalizar_telefone(p_identificador);
  v_insta text := public.normalizar_instagram(p_identificador);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || '|' || coalesce(v_tel, v_insta, p_identificador), 0));

  select c.id into v_id from clientes c
  where (v_tel is not null and c.telefone_normalizado = v_tel)
     or (v_insta is not null and c.instagram_normalizado = v_insta)
  order by c.created_at
  limit 1;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem, created_by, updated_by)
  values (p_user_id, p_data_contato, p_nome, p_identificador, p_origem::origem_tipo, p_created_by, p_created_by)
  returning clientes.id into v_id;

  return query select v_id, true;
end;
$$;

grant execute on function public.find_or_create_cliente(uuid, date, text, text, text, uuid) to service_role;
