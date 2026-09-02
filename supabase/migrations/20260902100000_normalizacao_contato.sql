create or replace function public.normalizar_telefone(p_texto text)
returns text
language sql
immutable
as $$
  select case
    when p_texto is null then null
    else nullif(
      case
        -- remove tudo que não é dígito
        when length(regexp_replace(p_texto, '\D', '', 'g')) >= 12
             and left(regexp_replace(p_texto, '\D', '', 'g'), 2) = '55'
        then substring(regexp_replace(p_texto, '\D', '', 'g') from 3)
        else regexp_replace(p_texto, '\D', '', 'g')
      end,
      ''
    )
  end
$$;

create or replace function public.normalizar_instagram(p_texto text)
returns text
language sql
immutable
as $$
  select nullif(lower((regexp_match(p_texto, '@?([\w.]+)'))[1]), '')
$$;
