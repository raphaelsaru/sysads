-- Auditoria do assistente IA. Conversas são efêmeras; o registro fica aqui.
-- Serve para detectar prompt injection e depurar respostas ruins.

CREATE TABLE IF NOT EXISTS public.assistant_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  requester_id    uuid NOT NULL REFERENCES auth.users(id),
  scope_user_id   uuid NOT NULL REFERENCES auth.users(id),
  pergunta        text NOT NULL,
  tools_chamadas  jsonb NOT NULL DEFAULT '[]'::jsonb,
  bloqueado       boolean NOT NULL DEFAULT false,
  motivo_bloqueio text,
  tokens_in       integer,
  tokens_out      integer,
  latency_ms      integer
);

CREATE INDEX IF NOT EXISTS assistant_audit_log_requester_idx
  ON public.assistant_audit_log (requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS assistant_audit_log_bloqueado_idx
  ON public.assistant_audit_log (created_at DESC) WHERE bloqueado;

ALTER TABLE public.assistant_audit_log ENABLE ROW LEVEL SECURITY;

-- Leitura: só admin.
CREATE POLICY assistant_audit_log_admin_select
  ON public.assistant_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Escrita: exclusiva do agente. Sem esta policy o RLS bloqueia os INSERTs.
CREATE POLICY assistant_audit_log_agent_insert
  ON public.assistant_audit_log FOR INSERT
  TO prizely_agent_ro
  WITH CHECK (true);

GRANT INSERT ON public.assistant_audit_log TO prizely_agent_ro;
