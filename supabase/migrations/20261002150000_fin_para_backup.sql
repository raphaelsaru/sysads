-- Tabelas do app Fin (finanças) saem do schema public (exposto pela API) p/ backup_fin.
-- Backup completo (estrutura, dados, gatilhos, policies). Nada do Prizely depende delas.
-- Restaurar: alter table backup_fin.<tabela> set schema public;
-- Apagar de vez: drop schema backup_fin cascade;
create schema if not exists backup_fin;
revoke all on schema backup_fin from public, anon, authenticated;

alter table public.transaction_items   set schema backup_fin;
alter table public.transactions        set schema backup_fin;
alter table public.recurring_templates set schema backup_fin;
alter table public.category_budgets    set schema backup_fin;
alter table public.custom_categories   set schema backup_fin;
alter table public.credit_cards        set schema backup_fin;
alter table public.bank_accounts       set schema backup_fin;
alter table public.investment_history  set schema backup_fin;
alter table public.investments         set schema backup_fin;
alter table public.financial_goals     set schema backup_fin;
alter table public.usage_logs          set schema backup_fin;
alter table public.subscriptions       set schema backup_fin;
alter table public.profiles            set schema backup_fin;
alter table public.plans               set schema backup_fin;
alter table public.user_whatsapp_links set schema backup_fin;
