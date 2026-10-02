-- Remove funções/gatilhos do app Fin (finanças) que sobraram no banco do Prizely.
-- Nenhuma é usada pelo CRM; várias eram executáveis por anon (alerta do advisor).
-- Tabelas do Fin (transactions, subscriptions, profiles, usage_logs, plans...) ficam por ora.

-- Todo usuário novo ganhava assinatura do Fin
drop trigger if exists on_auth_user_created_subscription on auth.users;
drop function if exists public.create_subscription_for_new_user();

-- Contador de mensagens WhatsApp do Fin (gatilhos em transactions)
drop trigger if exists trigger_increment_whatsapp_on_transaction on public.transactions;
drop trigger if exists trigger_decrement_whatsapp_on_transaction_delete on public.transactions;
drop function if exists public.increment_whatsapp_on_transaction();
drop function if exists public.decrement_whatsapp_on_transaction_delete();

drop function if exists public.create_whatsapp_transaction(uuid, text, text, text, text, date, text);
drop function if exists public.increment_whatsapp_message(uuid);
drop function if exists public.reset_whatsapp_messages_if_needed(uuid);
drop function if exists public.check_usage_limit(uuid);
drop function if exists public.get_monthly_usage(uuid);

-- Cadastro: só o perfil do CRM (antes também criava public.profiles do Fin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.user_profiles (id, role, full_name)
  values (
    NEW.id,
    'user',
    coalesce(
      nullif(trim(NEW.raw_user_meta_data ->> 'company_name'), ''),
      nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      split_part(NEW.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return NEW;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
