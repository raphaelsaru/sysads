-- Webhook (WAHA) criava uma negociação por MENSAGEM (bug desde 02/09: 254 clientes →
-- 1712 negociações em set/2026). Regra: só cria se o cliente não teve negociação
-- nos últimos p_janela_dias (retorno = nova negociação). Lock por cliente evita
-- duas negociações quando mensagens chegam juntas.
create or replace function public.registrar_negociacao_webhook(
  p_cliente_id uuid,
  p_data_contato date,
  p_user_id uuid,
  p_origem_evento_id text,
  p_janela_dias int default 30
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('negociacao_webhook|' || p_cliente_id::text, 0));

  if exists (
    select 1 from public.negociacoes
     where cliente_id = p_cliente_id
       and data_contato > p_data_contato - p_janela_dias
  ) then
    return false;
  end if;

  insert into public.negociacoes (cliente_id, data_contato, created_by, updated_by, origem_evento_id)
  values (p_cliente_id, p_data_contato, p_user_id, p_user_id, p_origem_evento_id);
  return true;
exception when unique_violation then
  -- reentrega do mesmo evento (origem_evento_id único)
  return false;
end $$;

revoke all on function public.registrar_negociacao_webhook(uuid, date, uuid, text, int) from public, anon, authenticated;
grant execute on function public.registrar_negociacao_webhook(uuid, date, uuid, text, int) to service_role;
