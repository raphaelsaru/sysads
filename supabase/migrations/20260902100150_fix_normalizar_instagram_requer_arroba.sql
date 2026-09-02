-- Bugfix (code review, Fase 0 lead-unico): normalizar_instagram exigia '@' opcional
-- (`@?`), então a regex casava o primeiro trecho de \w./dígitos de QUALQUER texto,
-- inclusive telefones sem @ (ex.: "+55 11 98124-7318" -> "55"). O design doc
-- (docs/plans/2026-09-02-lead-unico-design.md) já especifica '@' obrigatório.
-- Corrige a function e força recomputo da coluna gerada instagram_normalizado,
-- que não é recalculada automaticamente ao redefinir a function.

create or replace function public.normalizar_instagram(p_texto text)
returns text
language sql
immutable
as $$
  select nullif(lower((regexp_match(p_texto, '@([\w.]+)'))[1]), '')
$$;

-- Colunas geradas stored são calculadas no momento da escrita com a definição
-- da function vigente naquele momento; redefinir a function não recomputa
-- linhas existentes. Drop + re-add força o recomputo para todas as linhas
-- usando a function corrigida. Mantém tipo/expressão idênticos à migration
-- 20260902100100, só troca a function usada.
alter table public.clientes
  drop column if exists instagram_normalizado;

alter table public.clientes
  add column instagram_normalizado text
    generated always as (public.normalizar_instagram(whatsapp_instagram)) stored;
