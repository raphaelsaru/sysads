-- Apagar empresa com membros/leads deve falhar, não apagar em cascata.
alter table public.user_profiles drop constraint user_profiles_tenant_id_fkey,
  add constraint user_profiles_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete restrict;

alter table public.clientes drop constraint clientes_tenant_id_fkey,
  add constraint clientes_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete restrict;

alter table public.follow_ups drop constraint follow_ups_tenant_id_fkey,
  add constraint follow_ups_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete restrict;

-- negociacoes não tinha FK para tenants.
alter table public.negociacoes
  add constraint negociacoes_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete restrict;
