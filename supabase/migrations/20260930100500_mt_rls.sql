-- (select fn()) = avaliado uma vez por query (initPlan), não por linha.
-- clientes
drop policy if exists "Users can view own clientes" on public.clientes;
drop policy if exists "Users can update own clientes" on public.clientes;
drop policy if exists "Users can delete own clientes" on public.clientes;
drop policy if exists "Users can create clientes" on public.clientes;

create policy clientes_select on public.clientes for select
  using (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())));
create policy clientes_insert on public.clientes for insert
  with check (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())));
create policy clientes_update on public.clientes for update
  using (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())))
  with check (tenant_id = (select public.current_tenant_id()));
create policy clientes_delete on public.clientes for delete
  using (tenant_id = (select public.current_tenant_id()) and (user_id = (select auth.uid()) or (select public.is_tenant_owner())));

-- negociacoes
drop policy if exists negociacoes_select on public.negociacoes;
drop policy if exists negociacoes_insert on public.negociacoes;
drop policy if exists negociacoes_update on public.negociacoes;
drop policy if exists negociacoes_delete on public.negociacoes;

create policy negociacoes_select on public.negociacoes for select using (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy negociacoes_insert on public.negociacoes for insert with check (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy negociacoes_update on public.negociacoes for update using (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy negociacoes_delete on public.negociacoes for delete using (exists (
  select 1 from clientes c where c.id = negociacoes.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));

-- follow_ups
drop policy if exists "Users can view follow_ups" on public.follow_ups;
drop policy if exists "Users can create follow_ups" on public.follow_ups;
drop policy if exists "Users can delete follow_ups" on public.follow_ups;

create policy follow_ups_select on public.follow_ups for select using (exists (
  select 1 from clientes c where c.id = follow_ups.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy follow_ups_insert on public.follow_ups for insert with check (exists (
  select 1 from clientes c where c.id = follow_ups.cliente_id
    and c.tenant_id = (select public.current_tenant_id()) and (c.user_id = (select auth.uid()) or (select public.is_tenant_owner()))));
create policy follow_ups_delete on public.follow_ups for delete using (
  tenant_id = (select public.current_tenant_id()) and (created_by = (select auth.uid()) or (select public.is_tenant_owner())));

-- user_profiles
drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Admin full access to profiles" on public.user_profiles;

create policy user_profiles_select on public.user_profiles for select using (
  id = (select auth.uid())
  or (select public.is_superadmin())
  or (tenant_id = (select public.current_tenant_id()) and (select public.is_tenant_owner())));
create policy user_profiles_update_own on public.user_profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy user_profiles_superadmin on public.user_profiles for all
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));

-- tenants (escrita só via API/service role)
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select using (
  (select public.is_superadmin()) or id = (select public.current_tenant_id()));
