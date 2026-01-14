-- =====================================================
-- MIGRAÇÃO: SISTEMA DE FOLLOW-UPS
-- =====================================================
-- Adiciona tabela follow_ups para documentar follow-ups
-- realizados com clientes/leads
-- =====================================================

-- =====================================================
-- PASSO 1: CRIAR TABELA FOLLOW_UPS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  observacao text NOT NULL,
  respondeu boolean DEFAULT false NOT NULL,
  numero_followup integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT follow_ups_numero_followup_check CHECK (numero_followup > 0)
);

-- Comentários para documentação
COMMENT ON TABLE public.follow_ups IS 'Registra follow-ups realizados com clientes/leads';
COMMENT ON COLUMN public.follow_ups.cliente_id IS 'ID do cliente/lead relacionado';
COMMENT ON COLUMN public.follow_ups.observacao IS 'Observação sobre o follow-up realizado';
COMMENT ON COLUMN public.follow_ups.respondeu IS 'Indica se o cliente respondeu ao follow-up';
COMMENT ON COLUMN public.follow_ups.numero_followup IS 'Número sequencial do follow-up para este cliente';
COMMENT ON COLUMN public.follow_ups.created_by IS 'ID do usuário que criou o follow-up';
COMMENT ON COLUMN public.follow_ups.tenant_id IS 'ID do tenant proprietário deste follow-up';

-- =====================================================
-- PASSO 2: CRIAR ÍNDICES
-- =====================================================

-- Índice para buscar follow-ups por cliente
CREATE INDEX IF NOT EXISTS idx_follow_ups_cliente_id 
ON public.follow_ups(cliente_id);

-- Índice para buscar follow-ups por tenant
CREATE INDEX IF NOT EXISTS idx_follow_ups_tenant_id 
ON public.follow_ups(tenant_id);

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_follow_ups_created_at 
ON public.follow_ups(created_at DESC);

-- Índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_follow_ups_cliente_created 
ON public.follow_ups(cliente_id, created_at DESC);

-- =====================================================
-- PASSO 3: FUNÇÃO PARA CALCULAR NÚMERO DO FOLLOW-UP
-- =====================================================

-- Função que calcula o próximo número de follow-up para um cliente
CREATE OR REPLACE FUNCTION public.get_next_followup_number(p_cliente_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_number integer;
BEGIN
  -- Buscar o maior número de follow-up existente para este cliente
  SELECT COALESCE(MAX(numero_followup), 0) INTO v_max_number
  FROM public.follow_ups
  WHERE cliente_id = p_cliente_id;
  
  -- Retornar o próximo número
  RETURN v_max_number + 1;
END;
$$;

COMMENT ON FUNCTION public.get_next_followup_number(uuid) IS 'Calcula o próximo número sequencial de follow-up para um cliente';

-- =====================================================
-- PASSO 4: TRIGGER PARA CALCULAR NÚMERO AUTOMATICAMENTE
-- =====================================================

-- Função trigger que calcula o número do follow-up antes de inserir
CREATE OR REPLACE FUNCTION public.set_followup_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se o número não foi fornecido ou é 0, calcular automaticamente
  IF NEW.numero_followup IS NULL OR NEW.numero_followup = 0 THEN
    NEW.numero_followup := public.get_next_followup_number(NEW.cliente_id);
  END IF;
  
  -- Garantir que tenant_id está preenchido (usar o tenant_id do cliente)
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.clientes
    WHERE id = NEW.cliente_id;
  END IF;
  
  -- Garantir que created_by está preenchido
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_followup_number() IS 'Trigger que calcula automaticamente o número do follow-up e preenche campos obrigatórios';

-- Criar trigger antes de inserir
DROP TRIGGER IF EXISTS trigger_set_followup_number ON public.follow_ups;
CREATE TRIGGER trigger_set_followup_number
  BEFORE INSERT ON public.follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_followup_number();

-- =====================================================
-- PASSO 5: POLICIES RLS
-- =====================================================

-- Habilitar RLS na tabela
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- Remover policies existentes se houver
DROP POLICY IF EXISTS "Admin Global tem acesso total aos follow-ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Tenant User pode ver follow-ups do tenant" ON public.follow_ups;
DROP POLICY IF EXISTS "Tenant User pode criar follow-ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Tenant Admin pode gerenciar follow-ups do tenant" ON public.follow_ups;

-- Admin Global: Acesso total a todos os follow-ups
CREATE POLICY "Admin Global tem acesso total aos follow-ups"
ON public.follow_ups
FOR ALL
USING (public.is_admin_global())
WITH CHECK (public.is_admin_global());

-- Tenant User: Pode ver todos os follow-ups do seu tenant
CREATE POLICY "Tenant User pode ver follow-ups do tenant"
ON public.follow_ups
FOR SELECT
USING (tenant_id = public.get_user_tenant_id());

-- Tenant User: Pode criar follow-ups para clientes do seu tenant
CREATE POLICY "Tenant User pode criar follow-ups"
ON public.follow_ups
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE id = cliente_id 
    AND tenant_id = public.get_user_tenant_id()
  )
);

-- Tenant Admin: Pode gerenciar todos os follow-ups do tenant
CREATE POLICY "Tenant Admin pode gerenciar follow-ups do tenant"
ON public.follow_ups
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
);

-- =====================================================
-- PASSO 6: GRANT PERMISSIONS
-- =====================================================

-- Garantir que authenticated users podem acessar a tabela
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;

-- Garantir que authenticated users podem usar a função
GRANT EXECUTE ON FUNCTION public.get_next_followup_number(uuid) TO authenticated;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Verificar se a tabela foi criada corretamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'follow_ups'
ORDER BY ordinal_position;

-- Verificar índices
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'follow_ups';

-- Verificar policies RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'follow_ups'
ORDER BY policyname;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================



