-- Sincronizacao com Google Calendar: conexao unica do admin + mapeamento tatuador -> agenda.
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token      text NOT NULL,
  refresh_token     text NOT NULL,
  expiry_date       timestamptz NOT NULL,
  connected_email   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso só via service role (rotas de API), nunca direto do browser.

CREATE TABLE IF NOT EXISTS public.google_calendar_mappings (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id),
  calendar_id     text NOT NULL,
  calendar_name   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_mappings ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso só via service role (rotas de API), nunca direto do browser.
