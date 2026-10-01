-- Temporária: amostras do webhook WAHA p/ investigar nome do contato e ctwa_clid.
-- Só chaves + campos de nome/anúncio (sem texto da conversa). Remover após análise.
create table public.waha_diagnostico (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session text,
  amostra jsonb not null
);
alter table public.waha_diagnostico enable row level security;
revoke all on public.waha_diagnostico from anon, authenticated;
