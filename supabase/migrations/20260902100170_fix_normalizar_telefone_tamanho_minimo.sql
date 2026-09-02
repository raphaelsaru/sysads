-- Bugfix crítico (achado ao tentar Task 0.5, merge de duplicate clientes,
-- lead-unico): normalizar_telefone só removia não-dígitos, sem validar
-- tamanho mínimo. whatsapp_instagram é coluna freeform que guarda tanto
-- telefone quanto @handle do instagram (sem campo separado indicando qual).
-- Um handle como "@gelenz1" virava telefone_normalizado = "1" (1 dígito).
--
-- Auditoria em produção (4175 linhas em clientes) encontrou dezenas de
-- clusters falsos colidindo em telefone_normalizado curto ("1" x30, "3" x17,
-- "82" x15, "2" x13, "09" x10, "12" x10, etc) — pessoas totalmente distintas,
-- nomes diferentes, sem qualquer relação, coincidindo apenas no(s) último(s)
-- dígito(s) do handle do instagram. Isso alimenta clientes.telefone_normalizado
-- (generated column) que as Tasks 0.5 (merge) e 0.6 (unique constraint)
-- dependem — teria causado merges catastróficos de clientes/leads não
-- relacionados. Encontrado e corrigido ANTES de aplicar a migration de merge
-- (Task 0.5 continua pendente, não foi tentada aqui).
--
-- Correção: exige >= 10 dígitos no resultado FINAL (já com o "55" removido,
-- quando aplicável) — telefone BR real tem no mínimo DDD(2) + fixo(8) = 10
-- dígitos, até DDD(2) + celular(9) = 11, ou 12-13 com código do país "55".
-- Também: qualquer input começando com "@" é tratado como definitivamente-não-
-- telefone e retorna null direto, independente da contagem de dígitos — isso
-- cobre o caso de um handle todo numérico (ex: "@12345678901", que tem 11
-- dígitos e passaria no critério de tamanho mínimo sozinho, mas claramente não
-- é telefone). É uma checagem barata que ataca exatamente a causa raiz real
-- do bug (handles sendo lidos como telefone).
--
-- Força recomputo da coluna gerada telefone_normalizado, que não é
-- recalculada automaticamente ao redefinir a function (mesma técnica das
-- migrations 20260902100150 e 20260902100160, para instagram_normalizado).
-- Usa `add column if not exists`.

create or replace function public.normalizar_telefone(p_texto text)
returns text
language sql
immutable
as $$
  select case
    when p_texto is null then null
    -- handle de instagram (começa com @) nunca é telefone, mesmo que todo
    -- numérico depois do @ (ex: "@12345678901").
    when p_texto ~ '^\s*@' then null
    else nullif(
      case
        when length(regexp_replace(p_texto, '\D', '', 'g')) >= 12
             and left(regexp_replace(p_texto, '\D', '', 'g'), 2) = '55'
        then
          case
            when length(substring(regexp_replace(p_texto, '\D', '', 'g') from 3)) >= 10
            then substring(regexp_replace(p_texto, '\D', '', 'g') from 3)
            else ''
          end
        when length(regexp_replace(p_texto, '\D', '', 'g')) >= 10
        then regexp_replace(p_texto, '\D', '', 'g')
        else ''
      end,
      ''
    )
  end
$$;

alter table public.clientes
  drop column if exists telefone_normalizado;

alter table public.clientes
  add column if not exists telefone_normalizado text
    generated always as (public.normalizar_telefone(whatsapp_instagram)) stored;
