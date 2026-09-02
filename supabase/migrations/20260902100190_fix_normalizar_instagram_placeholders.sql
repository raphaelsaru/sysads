-- Bugfix (audit for Task 0.5 merge, lead-unico): normalizar_instagram extracts
-- ANY '@handle'-shaped text, including placeholders staff type by habit when a
-- lead has no real instagram — e.g. "@seminsta" ("sem insta" / "no instagram").
-- Live audit found 8 unrelated clientes rows (Lucila, Stephanie, Aahkeilah x2,
-- Katie, stweart, Tamara Melville, Yeimy) all with whatsapp_instagram containing
-- literal "@seminsta". Task 0.5's merge logic clusters rows by
-- instagram_normalizado, so all 8 distinct people would falsely merge into one
-- "canonical" cliente.
--
-- Correction: after the existing word-boundary-aware '@handle' extraction and
-- lowercasing, reject the result if it exactly matches a known "no instagram"
-- placeholder token (case-insensitive exact match, not substring/LIKE — a
-- substring check would risk nulling out a legitimate handle that merely
-- contains one of these tokens, e.g. some real handle containing "sn").
--
-- Denylist scope (conservative, not exhaustive): direct variants of the
-- confirmed pattern ("sem insta" family: seminsta, sem_insta) plus the most
-- obvious adjacent Portuguese "no contact info" placeholders staff might type
-- with an '@' prefix out of habit (naotem, nao_tem, semcontato, sem_contato,
-- naotemsinstagram, sn). Only "seminsta" is confirmed live in the 4175-row
-- table today; the rest are future-proofing against the same staff habit
-- recurring on new leads, kept short and directly tied to the observed
-- pattern rather than speculative enumeration.
--
-- Force recomputation of the generated column instagram_normalizado, same
-- technique as migrations 20260902100150/100160/100170/100180.

create or replace function public.normalizar_instagram(p_texto text)
returns text
language sql
immutable
as $$
  select case
    when lower((regexp_match(p_texto, '(?:^|[^\w])@([\w.]+)'))[1]) in (
      'seminsta',
      'sem_insta',
      'naotem',
      'nao_tem',
      'semcontato',
      'sem_contato',
      'naotemsinstagram',
      'sn'
    ) then null
    else nullif(lower((regexp_match(p_texto, '(?:^|[^\w])@([\w.]+)'))[1]), '')
  end
$$;

alter table public.clientes
  drop column if exists instagram_normalizado;

alter table public.clientes
  add column if not exists instagram_normalizado text
    generated always as (public.normalizar_instagram(whatsapp_instagram)) stored;
