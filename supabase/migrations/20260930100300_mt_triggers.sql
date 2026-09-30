-- clientes: tenant do dono do lead (cobre webhooks service role e superadmin visitando).
create or replace function public.set_cliente_tenant_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.effective_tenant_id(coalesce(NEW.user_id, auth.uid()));
  end if;
  if NEW.tenant_id is null then
    raise exception 'usuario sem empresa ativa';
  end if;
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;
$$;

create or replace function public.auto_fill_user_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.effective_tenant_id(coalesce(NEW.user_id, auth.uid()));
  end if;
  if TG_OP = 'INSERT' and NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  if TG_OP = 'UPDATE' then
    NEW.updated_by := auth.uid();
  end if;
  return NEW;
end;
$$;

-- negociacoes/follow_ups: sempre herdam do cliente.
create or replace function public.set_tenant_from_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select c.tenant_id into NEW.tenant_id from clientes c where c.id = NEW.cliente_id;
  if NEW.tenant_id is null then
    raise exception 'cliente inexistente';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_set_negociacao_tenant on public.negociacoes;
create trigger trigger_set_negociacao_tenant before insert on public.negociacoes
  for each row execute function public.set_tenant_from_cliente();

drop trigger if exists trigger_set_followup_tenant on public.follow_ups;
create trigger trigger_set_followup_tenant before insert on public.follow_ups
  for each row execute function public.set_tenant_from_cliente();

-- Campos privilegiados de user_profiles.
create or replace function public.proteger_campos_privilegiados()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_trusted_context() or public.is_superadmin() then
    return NEW;
  end if;

  if NEW.role is distinct from OLD.role then
    raise exception 'alteracao de role nao permitida';
  end if;
  if NEW.tenant_id is distinct from OLD.tenant_id then
    raise exception 'alteracao de tenant_id nao permitida';
  end if;
  if NEW.is_active is distinct from OLD.is_active then
    raise exception 'alteracao de is_active nao permitida';
  end if;
  if NEW.active_tenant_id is distinct from OLD.active_tenant_id then
    raise exception 'alteracao de active_tenant_id nao permitida';
  end if;
  if coalesce(NEW.preferences ->> 'assistant_enabled', 'false')
     is distinct from coalesce(OLD.preferences ->> 'assistant_enabled', 'false') then
    raise exception 'alteracao de assistant_enabled nao permitida';
  end if;
  return NEW;
end;
$$;

-- Slots: usuários ativos por empresa (dono incluso). Vale inclusive p/ service role.
create or replace function public.validar_slots()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_ativos int;
begin
  if NEW.tenant_id is null or not NEW.is_active then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.tenant_id is not distinct from NEW.tenant_id and OLD.is_active then
    return NEW;
  end if;

  select max_users into v_max from tenants where id = NEW.tenant_id for update;
  select count(*) into v_ativos from user_profiles
   where tenant_id = NEW.tenant_id and is_active and id <> NEW.id;

  if v_max is not null and v_ativos >= v_max then
    raise exception 'limite de usuarios da empresa atingido' using errcode = 'P0001', hint = 'slots';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_validar_slots on public.user_profiles;
create trigger trigger_validar_slots before insert or update of tenant_id, is_active on public.user_profiles
  for each row execute function public.validar_slots();

-- tenants: max_users não pode ficar abaixo dos ativos.
create or replace function public.validar_max_users()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ativos int;
begin
  if NEW.max_users is distinct from OLD.max_users then
    select count(*) into v_ativos from user_profiles where tenant_id = NEW.id and is_active;
    if NEW.max_users < v_ativos then
      raise exception 'slots menor que usuarios ativos (%)', v_ativos using errcode = 'P0001', hint = 'slots';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trigger_validar_max_users on public.tenants;
create trigger trigger_validar_max_users before update of max_users on public.tenants
  for each row execute function public.validar_max_users();

-- tenant_id passa a ser preenchido pelos triggers acima, não por default fixo.
alter table public.clientes    alter column tenant_id drop default;
alter table public.negociacoes alter column tenant_id drop default;
alter table public.follow_ups  alter column tenant_id drop default;
