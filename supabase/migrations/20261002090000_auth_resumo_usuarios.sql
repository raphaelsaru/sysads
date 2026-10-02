-- Email/convite/moeda de vários usuários numa consulta (rotas de equipe faziam
-- 1 chamada à Admin API por usuário). Só service role.
create or replace function public.auth_resumo_usuarios(p_ids uuid[])
returns table (id uuid, email text, last_sign_in_at timestamptz, currency text)
language sql stable security definer set search_path to 'public' as $$
  select u.id, u.email::text, u.last_sign_in_at, u.raw_user_meta_data ->> 'currency'
    from auth.users u
   where u.id = any(p_ids);
$$;

revoke execute on function public.auth_resumo_usuarios(uuid[]) from public, anon, authenticated;
grant execute on function public.auth_resumo_usuarios(uuid[]) to service_role;
