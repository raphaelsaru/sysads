ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_alert_at timestamptz;
