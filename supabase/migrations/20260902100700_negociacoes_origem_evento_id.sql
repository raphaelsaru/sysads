-- Idempotency key for negociacoes criadas via webhook (WAHA).
-- WAHA pode reentregar o mesmo evento em caso de timeout/erro; sem chave de
-- idempotencia, cada reentrega cria outra negociacao duplicada pro mesmo
-- contato. origem_evento_id guarda o id da mensagem WAHA (payload.id) que
-- originou a negociacao; fica NULL pra negociacoes criadas manualmente, que
-- nao tem esse conceito.
alter table public.negociacoes add column origem_evento_id text;

create unique index negociacoes_origem_evento_id_uidx
  on public.negociacoes(origem_evento_id)
  where origem_evento_id is not null;
