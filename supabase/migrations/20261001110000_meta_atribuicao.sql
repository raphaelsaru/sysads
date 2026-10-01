alter table public.negociacoes
  add column if not exists meta_ad_id text,
  add column if not exists meta_sender_id text,
  add column if not exists meta_ig_account_id text,
  add column if not exists meta_ctwa_clid text,
  add column if not exists meta_lead_id text,
  add column if not exists fbc text,
  add column if not exists fbp text,
  add column if not exists fbclid text;

alter table public.clientes
  add column if not exists email text;
