-- Bugfix crítico (code review, achado antes de rodar Task 0.5, merge de
-- duplicate clientes, lead-unico): o piso de >= 10 dígitos (migration
-- 20260902100170) não é suficiente sozinho. whatsapp_instagram é coluna
-- freeform que às vezes guarda anotação/follow-up em prosa (não telefone nem
-- @handle), e a prosa pode acidentalmente reduzir, ao remover não-dígitos,
-- para uma sequência de dígitos de tamanho plausível de telefone.
--
-- Exemplo confirmado em produção: cliente "Mirela" tem
-- whatsapp_instagram = "14/08 Do zero, quer trabalhar com tatuagem... 17/08...
-- 18/08..." (nota de follow-up, não contato) que normalizava para
-- telefone_normalizado = '14081708180831' (14 dígitos — fragmentos de datas
-- concatenados). Hoje é inofensivo (não colide com nenhuma outra linha), mas
-- a lógica de merge da Task 0.5 trata duas linhas com o mesmo
-- telefone_normalizado como a mesma pessoa — então qualquer prosa que reduza
-- para a mesma sequência de dígitos de outra linha (telefone real ou outra
-- prosa) causaria merge falso.
--
-- Correção: rejeita (retorna null) input bruto que contém qualquer letra
-- ([a-zA-Z]) — telefone real, em qualquer formatação
-- ("(11) 99999-8888", "+55 11 98515-1653", "11985151653"), nunca contém
-- letra; só prosa/anotação/nome passando pelo digit-stripper teria letras.
-- Checagem feita ANTES de qualquer remoção de dígitos, como short-circuit,
-- igual ao guard existente de "@"-prefix. Mantém intacta toda lógica
-- existente (mínimo de 10 dígitos, remoção de prefixo "55", guard de "@").
--
-- Força recomputo da coluna gerada telefone_normalizado (mesma técnica das
-- migrations anteriores). Usa `add column if not exists`.

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
    -- input com qualquer letra é prosa/anotação/nome, não telefone. Telefone
    -- real (formatado ou não) nunca contém letra.
    when p_texto ~ '[a-zA-Z]' then null
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
