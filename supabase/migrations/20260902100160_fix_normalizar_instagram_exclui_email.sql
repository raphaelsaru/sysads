-- Bugfix (code review, Fase 0 lead-unico): normalizar_instagram usava '@([\w.]+)'
-- sem checar o que precede o '@', então casava emails como "foo@gmail.com" ->
-- extraía "gmail.com" como um "handle" falso. Duas leads distintas que digitaram
-- um email na coluna whatsapp_instagram colidiriam em instagram_normalizado =
-- 'gmail.com' (mesma classe de risco de falso-merge do bug de telefone já
-- corrigido, só que via email em vez de número de telefone).
--
-- Correção: exige que o '@' não seja precedido por um caractere \w (letra/
-- dígito/_), ou seja, só casa no início da string ou depois de um caractere
-- não-\w (espaço, vírgula, dois-pontos, início da string). Isso distingue uma
-- menção real de "@handle" (inclusive com prefixo tipo "IG: @handle") de um
-- email "local@domain", onde o '@' fica colado à parte local.
--
-- Blast radius real (checado antes de aplicar): 0 linhas em produção tinham
-- email colado ao '@' (padrão \w@...). É uma correção preventiva alinhada ao
-- design doc, não uma correção de dado já quebrado.
--
-- Força recomputo da coluna gerada instagram_normalizado, que não é
-- recalculada automaticamente ao redefinir a function (mesma técnica da
-- migration 20260902100150). Usa `add column if not exists` (boa prática,
-- migration anterior não usou).

create or replace function public.normalizar_instagram(p_texto text)
returns text
language sql
immutable
as $$
  select nullif(lower((regexp_match(p_texto, '(?:^|[^\w])@([\w.]+)'))[1]), '')
$$;

alter table public.clientes
  drop column if exists instagram_normalizado;

alter table public.clientes
  add column if not exists instagram_normalizado text
    generated always as (public.normalizar_instagram(whatsapp_instagram)) stored;
