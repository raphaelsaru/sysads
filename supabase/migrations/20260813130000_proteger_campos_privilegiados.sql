-- Protege campos privilegiados de user_profiles contra auto-edição.
--
-- PROBLEMA
-- A policy "Users can update own profile" tem WITH CHECK apenas
-- (id = auth.uid()), e o role `authenticated` tem GRANT UPDATE na tabela.
-- Nenhuma coluna é pinada e não havia trigger. Resultado: qualquer usuário
-- logado podia se promover a admin com um PATCH direto no PostgREST:
--
--   PATCH /rest/v1/user_profiles?id=eq.<proprio-id>  {"role":"admin"}
--
-- (A migration 002_rls_policies.sql pinava `role` no WITH CHECK, mas a
-- policy viva em produção havia sido substituída por uma versão sem isso.)
--
-- Além do óbvio, isso quebrava duas garantias do assistente IA:
-- liberar a feature deixava de ser decisão do admin, e o gate de
-- impersonação — que confia em role = 'admin' — virava contornável.
--
-- SOLUÇÃO
-- Trigger em vez de policy. Referenciar user_profiles dentro de uma policy
-- da própria user_profiles causa recursão de RLS; o trigger não tem esse
-- problema e ainda produz mensagem de erro clara.

CREATE OR REPLACE FUNCTION public.proteger_campos_privilegiados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (chave de serviço, server-side) e admins passam direto.
  IF current_user = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'alteracao de role nao permitida';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'alteracao de tenant_id nao permitida';
  END IF;

  IF coalesce(NEW.preferences ->> 'assistant_enabled', 'false')
     IS DISTINCT FROM
     coalesce(OLD.preferences ->> 'assistant_enabled', 'false') THEN
    RAISE EXCEPTION 'alteracao de assistant_enabled nao permitida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_proteger_campos_privilegiados ON public.user_profiles;

CREATE TRIGGER trigger_proteger_campos_privilegiados
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_campos_privilegiados();
