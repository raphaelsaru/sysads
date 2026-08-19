-- Contas do Instagram conectadas via self-service (OAuth Instagram Login).
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  ig_user_id        text NOT NULL UNIQUE,
  username          text,
  access_token      text NOT NULL,
  token_expires_at  timestamptz,
  status            text NOT NULL DEFAULT 'connected'
                      CHECK (status IN ('connected', 'disconnected', 'failed')),
  connected_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY instagram_accounts_select_own
  ON public.instagram_accounts FOR SELECT
  USING (user_id = auth.uid());
