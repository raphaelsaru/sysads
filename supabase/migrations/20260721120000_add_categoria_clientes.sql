-- Campo opcional "categoria" para segmentação de leads específica por usuário (ex: Victor / Charbelle)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS categoria text;
