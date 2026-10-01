-- Conversas sem anúncio viram lead só se a conta NÃO segue o remetente
-- (filtra amigos/família). Desligado por padrão: só anúncios viram lead.
alter table public.instagram_accounts
  add column if not exists capturar_nao_seguidos boolean not null default false;
