-- Task 0.6 criou indices unicos escopados por user_id (dedup por vendedor).
-- Decisao do produto: dedup deve ser global (um lead = uma pessoa em todo o CRM,
-- mesmo que dois vendedores diferentes tenham cadastrado o mesmo contato).
-- Task 0.5 (merge) ja rodou sem particionar por user_id, entao ja era efetivamente
-- global; apenas a constraint do Task 0.6 ficou inconsistente com isso.

drop index if exists public.clientes_telefone_normalizado_uidx;
drop index if exists public.clientes_instagram_normalizado_uidx;

create unique index clientes_telefone_normalizado_uidx
  on public.clientes(telefone_normalizado) where telefone_normalizado is not null;

create unique index clientes_instagram_normalizado_uidx
  on public.clientes(instagram_normalizado) where instagram_normalizado is not null;
