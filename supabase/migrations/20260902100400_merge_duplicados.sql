do $$
declare
  v_clusters int := 0;
  v_linhas int := 0;
begin
  with clusters as (
    select telefone_normalizado, array_agg(id order by created_at) as ids
    from public.clientes
    where telefone_normalizado is not null
    group by telefone_normalizado
    having count(*) > 1
  ),
  merges as (
    select ids[1] as canonico, unnest(ids[2:]) as duplicado
    from clusters
  ),
  reponta_followups as (
    update public.follow_ups f
    set cliente_id = m.canonico
    from merges m
    where f.cliente_id = m.duplicado
    returning 1
  ),
  reponta_negociacoes as (
    update public.negociacoes n
    set cliente_id = m.canonico
    from merges m
    where n.cliente_id = m.duplicado
    returning 1
  ),
  apaga as (
    delete from public.clientes c
    using merges m
    where c.id = m.duplicado
    returning 1
  )
  select count(*), count(distinct canonico) from merges into v_linhas, v_clusters;

  raise notice 'telefone: % clusters, % linhas mescladas', v_clusters, v_linhas;

  with clusters as (
    select instagram_normalizado, array_agg(id order by created_at) as ids
    from public.clientes
    where instagram_normalizado is not null
    group by instagram_normalizado
    having count(*) > 1
  ),
  merges as (
    select ids[1] as canonico, unnest(ids[2:]) as duplicado
    from clusters
  ),
  reponta_followups as (
    update public.follow_ups f
    set cliente_id = m.canonico
    from merges m
    where f.cliente_id = m.duplicado
    returning 1
  ),
  reponta_negociacoes as (
    update public.negociacoes n
    set cliente_id = m.canonico
    from merges m
    where n.cliente_id = m.duplicado
    returning 1
  ),
  apaga as (
    delete from public.clientes c
    using merges m
    where c.id = m.duplicado
    returning 1
  )
  select count(*), count(distinct canonico) from merges into v_linhas, v_clusters;

  raise notice 'instagram: % clusters, % linhas mescladas', v_clusters, v_linhas;
end $$;
