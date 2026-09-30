-- Funções legadas security definer que vazariam/alterariam dados entre empresas.
-- App não usa nenhuma via RPC; service_role mantém acesso (assistente/cron).
revoke execute on function
  public.fix_clientes_tenant_mismatch(),
  public.count_tenant_clients(uuid),
  public.get_current_tenant(),
  public.check_client_limit(uuid),
  public.has_ocr_instagram_enabled(uuid),
  public.get_all_users_admin(),
  public.get_all_users_for_admin(),
  public.get_user_clientes_admin(uuid),
  public.get_leads_for_notification_today(),
  public.get_next_followup_number(uuid),
  public.transfer_temp_data_to_user(uuid, text),
  public.debug_rls_info(),
  public.is_admin_simple()
from public, anon, authenticated;

-- View passa a respeitar RLS de quem consulta.
alter view public.tenant_statistics set (security_invoker = on);
revoke all on public.tenant_statistics from anon;

-- Backup de dedup exposto sem RLS (PII de leads). RLS sem policy = só service_role.
alter table public.clientes_dedup_backup_20260822 enable row level security;
