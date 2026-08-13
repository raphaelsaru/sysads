-- Endurece o log de auditoria do assistente IA.
--
-- Tabelas novas no schema public herdam grants completos para anon e
-- authenticated. Hoje só o RLS impede a escrita — não existe policy de
-- INSERT/UPDATE/DELETE para esses roles, então tudo é negado.
--
-- O problema é que essa proteção depende da AUSÊNCIA de uma policy: basta
-- alguém adicionar um FOR ALL permissivo no futuro e qualquer usuário passa
-- a poder adulterar o log. Um log adulterável não serve para auditar nada.
--
-- Revogando o privilégio na base, a proteção deixa de depender disso.
-- SELECT permanece: a policy assistant_audit_log_admin_select precisa dele
-- para que admins consigam ler o log pelo client.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.assistant_audit_log
  FROM anon, authenticated;
