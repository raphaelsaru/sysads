alter table public.user_profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists active_tenant_id uuid references public.tenants(id) on delete set null;

-- Backfill sem disparar triggers de usuário (proteção de campos, updated_by/updated_at).
alter table public.user_profiles disable trigger user;
alter table public.clientes      disable trigger user;
alter table public.negociacoes   disable trigger user;
alter table public.follow_ups    disable trigger user;

-- Consolida as duas "Prizely" no tenant canônico 0000...0001.
update public.user_profiles
   set tenant_id = '00000000-0000-0000-0000-000000000001'
 where tenant_id is distinct from '00000000-0000-0000-0000-000000000001';

update public.clientes    set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id <> '00000000-0000-0000-0000-000000000001';
update public.negociacoes set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id <> '00000000-0000-0000-0000-000000000001';
update public.follow_ups  set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id <> '00000000-0000-0000-0000-000000000001';

alter table public.user_profiles enable trigger user;
alter table public.clientes      enable trigger user;
alter table public.negociacoes   enable trigger user;
alter table public.follow_ups    enable trigger user;

update public.tenants
   set name = 'Prizely (antigo)'
 where id = '8096819e-1349-4595-bfab-c998ad340ca7';

-- Prizely: slots = usuários atuais; sem cor custom (usa tema padrão).
update public.tenants
   set max_users = (select count(*) from public.user_profiles where tenant_id = '00000000-0000-0000-0000-000000000001'),
       is_active = true,
       branding = coalesce(branding, '{}'::jsonb) - 'primaryColor' - 'secondaryColor'
 where id = '00000000-0000-0000-0000-000000000001';
