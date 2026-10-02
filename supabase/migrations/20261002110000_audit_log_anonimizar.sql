-- LGPD: pedido de exclusão de dados (manual, ver /exclusao-de-dados) também anonimiza
-- os logs do cliente. Uso: select public.anonimizar_auditoria_cliente('<cliente_id>');
-- Mantém quem fez/quando/o quê; remove nome e valores dos campos.
create or replace function public.anonimizar_auditoria_cliente(p_cliente uuid)
returns integer language sql volatile security definer set search_path to 'public' as $$
  with alterados as (
    update audit_log
       set rotulo = 'Cliente removido (LGPD)',
           mudancas = (select coalesce(jsonb_object_agg(k, '"[removido]"'::jsonb), '{}'::jsonb)
                         from jsonb_object_keys(mudancas) k)
     where registro_id = p_cliente and tabela in ('clientes', 'negociacoes', 'follow_ups')
    returning 1
  )
  select count(*)::int from alterados;
$$;

revoke execute on function public.anonimizar_auditoria_cliente(uuid) from public, anon, authenticated;
grant execute on function public.anonimizar_auditoria_cliente(uuid) to service_role;
