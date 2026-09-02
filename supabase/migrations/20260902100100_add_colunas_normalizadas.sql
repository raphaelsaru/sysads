alter table public.clientes
  add column if not exists telefone_normalizado text
    generated always as (public.normalizar_telefone(whatsapp_instagram)) stored,
  add column if not exists instagram_normalizado text
    generated always as (public.normalizar_instagram(whatsapp_instagram)) stored;
