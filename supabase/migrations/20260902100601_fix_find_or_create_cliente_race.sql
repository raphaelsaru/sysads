-- Fix Task 0.7 race: find_or_create_cliente's advisory lock was scoped by
-- p_user_id, but dedup is global (indices unicos de telefone/instagram_normalizado
-- nao sao mais escopados por user_id, ver 20260902100501). Duas chamadas
-- concorrentes de USUARIOS DIFERENTES para o mesmo identificador pegavam locks
-- DIFERENTES (chaves distintas por causa do p_user_id), entao nenhuma delas
-- bloqueava a outra: ambas passavam pelo SELECT sem ver o INSERT nao commitado
-- uma da outra, e ambas tentavam INSERT. O indice unico global rejeitava
-- corretamente o segundo INSERT (integridade dos dados ok), mas sem exception
-- handling isso vazava como erro 23505 unhandled em vez de seguir o contrato
-- documentado da funcao (retornar a linha existente com created:false).
--
-- Duas correcoes (belt and suspenders):
-- 1. Lock agora e chaveado só pelo identificador (sem p_user_id) — global,
--    para que chamadas concorrentes de QUALQUER usuario para o mesmo
--    identificador se serializem corretamente entre si.
-- 2. Exception handling em volta do INSERT: mesmo que o escopo do lock mude
--    de novo no futuro, ou algum outro caller ignore a disciplina do lock,
--    um unique_violation no INSERT nao propaga mais como erro — a funcao
--    reexecuta o SELECT (a linha da transacao vencedora ja estara visivel
--    apos o commit dela) e retorna essa linha existente com created:false.
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
  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_tel, v_insta, p_identificador), 0));

  select c.id into v_id from clientes c
  where (v_tel is not null and c.telefone_normalizado = v_tel)
     or (v_insta is not null and c.instagram_normalizado = v_insta)
  order by c.created_at
  limit 1;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  begin
    insert into clientes (user_id, data_contato, nome, whatsapp_instagram, origem, created_by, updated_by)
    values (p_user_id, p_data_contato, p_nome, p_identificador, p_origem::origem_tipo, p_created_by, p_created_by)
    returning clientes.id into v_id;
  exception when unique_violation then
    select c.id into v_id from clientes c
    where (v_tel is not null and c.telefone_normalizado = v_tel)
       or (v_insta is not null and c.instagram_normalizado = v_insta)
    order by c.created_at
    limit 1;

    return query select v_id, false;
    return;
  end;

  return query select v_id, true;
end;
$$;

grant execute on function public.find_or_create_cliente(uuid, date, text, text, text, uuid) to service_role;
