-- Sessões WAHA por usuário, para conexão self-service do WhatsApp.
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  session_name  text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'connected', 'disconnected', 'failed')),
  phone_number  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  connected_at  timestamptz
);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_sessions_select_own
  ON public.whatsapp_sessions FOR SELECT
  USING (user_id = auth.uid());
