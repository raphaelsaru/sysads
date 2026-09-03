-- Task 5.3: remove create_lead_dedup, substituida por find_or_create_cliente.
drop function if exists public.create_lead_dedup(uuid, date, text, text, text, uuid);
