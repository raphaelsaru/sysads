-- Role dedicado do assistente IA. SOMENTE LEITURA.
-- Se um bug deixar SQL arbitrário passar, o Postgres recusa a escrita.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prizely_agent_ro') THEN
    -- A senha real é definida fora daqui (ALTER ROLE) para não versionar segredo.
    CREATE ROLE prizely_agent_ro LOGIN PASSWORD 'trocar-depois';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO prizely_agent_ro;

GRANT SELECT ON public.clientes       TO prizely_agent_ro;
GRANT SELECT ON public.user_profiles  TO prizely_agent_ro;

-- Trava o default: nenhuma tabela futura vira acessível sozinha.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM prizely_agent_ro;
