create table public.meta_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete restrict,
  dataset_id text not null,
  token_secret_id uuid,
  is_active boolean not null default false,
  test_event_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- só service role (token/config nunca vão ao browser)
alter table public.meta_integrations enable row level security;
revoke all on public.meta_integrations from anon, authenticated;

create or replace function public.meta_salvar_token(p_tenant uuid, p_token text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  select token_secret_id into v_id from public.meta_integrations where tenant_id = p_tenant;
  if not found then raise exception 'integracao meta inexistente'; end if;
  if v_id is null then
    v_id := vault.create_secret(p_token, 'meta_token_' || p_tenant::text);
    update public.meta_integrations set token_secret_id = v_id, updated_at = now() where tenant_id = p_tenant;
  else
    perform vault.update_secret(v_id, p_token);
    update public.meta_integrations set updated_at = now() where tenant_id = p_tenant;
  end if;
end $$;

create or replace function public.meta_ler_token(p_tenant uuid)
returns text language sql security definer set search_path = public, vault as $$
  select s.decrypted_secret
  from public.meta_integrations i
  join vault.decrypted_secrets s on s.id = i.token_secret_id
  where i.tenant_id = p_tenant
$$;

revoke all on function public.meta_salvar_token(uuid, text) from public, anon, authenticated;
revoke all on function public.meta_ler_token(uuid) from public, anon, authenticated;
grant execute on function public.meta_salvar_token(uuid, text) to service_role;
grant execute on function public.meta_ler_token(uuid) to service_role;
