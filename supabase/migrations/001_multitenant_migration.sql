-- =====================================================
-- MIGRAÇÃO MULTITENANT - PRIZELY
-- =====================================================
-- Este script migra o sistema para o modelo multitenant completo
-- Execução: Aplicar via Supabase CLI ou Dashboard
-- =====================================================

-- =====================================================
-- PASSO 1: CRIAR TENANT PADRÃO "PRIZELY"
-- =====================================================

-- Criar tenant padrão para dados existentes
INSERT INTO public.tenants (
  id,
  name,
  slug,
  description,
  max_clients,
  max_users,
  is_active,
  branding,
  settings,
  metadata
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Prizely',
  'prizely',
  'Tenant padrão do sistema',
  10000,
  100,
  true,
  jsonb_build_object(
    'logo', null,
    'companyName', 'Prizely',
    'primaryColor', '#3b82f6',
    'secondaryColor', '#8b5cf6'
  ),
  jsonb_build_object(),
  jsonb_build_object('isDefault', true)
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PASSO 2: MIGRAR USUÁRIOS PARA USER_PROFILES
-- =====================================================

-- Migrar usuários existentes da tabela users para user_profiles
INSERT INTO public.user_profiles (
  id,
  tenant_id,
  role,
  full_name,
  phone,
  preferences,
  created_at,
  updated_at
)
SELECT 
  u.id,
  '00000000-0000-0000-0000-000000000001'::uuid as tenant_id,
  CASE 
    WHEN u.role = 'admin' THEN 'admin_global'::public.user_role
    ELSE 'tenant_user'::public.user_role
  END as role,
  u.company_name as full_name,
  NULL as phone,
  jsonb_build_object(
    'currency', u.currency,
    'company_name', u.company_name
  ) as preferences,
  u.created_at,
  u.updated_at
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = u.id
);

-- =====================================================
-- PASSO 3: ATUALIZAR CLIENTES COM TENANT_ID
-- =====================================================

-- Atualizar clientes existentes para referenciar o tenant padrão
UPDATE public.clientes
SET 
  tenant_id = '00000000-0000-0000-0000-000000000001'::uuid,
  created_by = COALESCE(created_by, user_id),
  updated_by = COALESCE(updated_by, user_id)
WHERE tenant_id IS NULL;

-- =====================================================
-- PASSO 4: ADICIONAR CAMPOS FALTANTES
-- =====================================================

-- Adicionar coluna onboarding_completed se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenants' 
    AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE public.tenants 
    ADD COLUMN onboarding_completed boolean DEFAULT true;
  END IF;
END $$;

-- Marcar tenant padrão como onboarding completo
UPDATE public.tenants 
SET onboarding_completed = true 
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Adicionar coluna onboarding_completed_at se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenants' 
    AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE public.tenants 
    ADD COLUMN onboarding_completed_at timestamp with time zone;
  END IF;
END $$;

-- =====================================================
-- PASSO 5: CRIAR/ATUALIZAR FUNÇÕES HELPER
-- =====================================================

-- Função para verificar se usuário é admin global
CREATE OR REPLACE FUNCTION public.is_admin_global() 
RETURNS boolean
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin_global'
  );
$$;

COMMENT ON FUNCTION public.is_admin_global() IS 'Verifica se o usuário autenticado é admin global';

-- Função para verificar se usuário é tenant admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin() 
RETURNS boolean
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'tenant_admin'
  );
$$;

COMMENT ON FUNCTION public.is_tenant_admin() IS 'Verifica se o usuário autenticado é admin do tenant';

-- Função para obter tenant_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_tenant_id() 
RETURNS uuid
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT tenant_id 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_tenant_id() IS 'Retorna o tenant_id do usuário autenticado';

-- Função para obter role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role() 
RETURNS public.user_role
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT role 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role() IS 'Retorna a role do usuário autenticado';

-- Função para verificar limite de clientes do tenant
-- Remover políticas que dependem da função antes de remover a função
DROP POLICY IF EXISTS "Tenant User pode criar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Tenant Admin pode gerenciar clientes do tenant" ON public.clientes;

-- Remover função antiga se existir (para permitir mudança de parâmetros)
DROP FUNCTION IF EXISTS public.check_client_limit(uuid);

CREATE FUNCTION public.check_client_limit(p_tenant_id uuid) 
RETURNS boolean
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_max_clients integer;
  v_current_clients integer;
BEGIN
  -- Buscar limite máximo de clientes do tenant
  SELECT max_clients INTO v_max_clients
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Se não encontrar tenant, retornar false
  IF v_max_clients IS NULL THEN
    RETURN false;
  END IF;
  
  -- Contar clientes atuais do tenant
  SELECT COUNT(*) INTO v_current_clients
  FROM public.clientes
  WHERE tenant_id = p_tenant_id;
  
  -- Retornar true se ainda há espaço
  RETURN v_current_clients < v_max_clients;
END;
$$;

COMMENT ON FUNCTION public.check_client_limit(uuid) IS 'Verifica se o tenant ainda pode adicionar mais clientes';

-- Função para verificar limite de usuários do tenant
-- Remover políticas que dependem da função antes de remover a função
DROP POLICY IF EXISTS "Tenant Admin pode gerenciar usuários do tenant" ON public.user_profiles;

-- Remover função antiga se existir (para permitir mudança de parâmetros)
DROP FUNCTION IF EXISTS public.check_user_limit(uuid);

CREATE FUNCTION public.check_user_limit(p_tenant_id uuid) 
RETURNS boolean
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_max_users integer;
  v_current_users integer;
BEGIN
  -- Buscar limite máximo de usuários do tenant
  SELECT max_users INTO v_max_users
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Se não encontrar tenant, retornar false
  IF v_max_users IS NULL THEN
    RETURN false;
  END IF;
  
  -- Contar usuários atuais do tenant
  SELECT COUNT(*) INTO v_current_users
  FROM public.user_profiles
  WHERE tenant_id = p_tenant_id;
  
  -- Retornar true se ainda há espaço
  RETURN v_current_users < v_max_users;
END;
$$;

COMMENT ON FUNCTION public.check_user_limit(uuid) IS 'Verifica se o tenant ainda pode adicionar mais usuários';

-- Recriar políticas que dependem das funções (após recriar as funções)
-- Tenant User: Pode criar clientes no seu tenant (respeitando limite)
CREATE POLICY "Tenant User pode criar clientes"
ON public.clientes
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.check_client_limit(tenant_id)
);

-- Tenant Admin: Pode gerenciar todos os clientes do tenant
CREATE POLICY "Tenant Admin pode gerenciar clientes do tenant"
ON public.clientes
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
  AND public.check_client_limit(tenant_id)
);

-- Tenant Admin: Pode gerenciar usuários do seu tenant
CREATE POLICY "Tenant Admin pode gerenciar usuários do tenant"
ON public.user_profiles
FOR ALL
USING (
  tenant_id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
  AND public.check_user_limit(tenant_id)
);

-- =====================================================
-- PASSO 6: CRIAR TRIGGERS
-- =====================================================

-- Trigger para auto-populate tenant_id em clientes
CREATE OR REPLACE FUNCTION public.set_cliente_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se tenant_id não foi fornecido, usar o do usuário autenticado
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_user_tenant_id();
  END IF;
  
  -- Auto-populate created_by se não fornecido
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_set_cliente_tenant_id ON public.clientes;

-- Criar trigger
CREATE TRIGGER trigger_set_cliente_tenant_id
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cliente_tenant_id();

-- Trigger para atualizar updated_by em clientes
CREATE OR REPLACE FUNCTION public.set_cliente_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_set_cliente_updated_by ON public.clientes;

-- Criar trigger
CREATE TRIGGER trigger_set_cliente_updated_by
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cliente_updated_by();

-- Trigger para updated_at em tenants
DROP TRIGGER IF EXISTS trigger_tenants_updated_at ON public.tenants;

CREATE TRIGGER trigger_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger para updated_at em user_profiles
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON public.user_profiles;

CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- PASSO 7: CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para tenant_id (queries mais comuns)
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_id ON public.clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON public.user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_created_by ON public.clientes(tenant_id, created_by);

-- Índices para buscas por role
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role ON public.user_profiles(tenant_id, role);

-- Índice para tenant slug (usado para routing)
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants(is_active);

-- =====================================================
-- PASSO 8: ADICIONAR CONSTRAINTS
-- =====================================================

-- Garantir que tenant_id não seja nulo em clientes
ALTER TABLE public.clientes 
  ALTER COLUMN tenant_id SET NOT NULL;

-- Garantir que created_by não seja nulo em clientes novos
-- (apenas para novos registros, não afeta dados existentes)
-- Removendo a constraint NOT NULL pois dados antigos podem não ter

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Contar registros migrados
DO $$
DECLARE
  v_tenant_count integer;
  v_user_profile_count integer;
  v_clientes_count integer;
BEGIN
  SELECT COUNT(*) INTO v_tenant_count FROM public.tenants;
  SELECT COUNT(*) INTO v_user_profile_count FROM public.user_profiles;
  SELECT COUNT(*) INTO v_clientes_count FROM public.clientes WHERE tenant_id IS NOT NULL;
  
  RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA ===';
  RAISE NOTICE 'Tenants criados: %', v_tenant_count;
  RAISE NOTICE 'User profiles: %', v_user_profile_count;
  RAISE NOTICE 'Clientes com tenant_id: %', v_clientes_count;
END $$;

-- Listar funções criadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'is_admin_global',
  'is_tenant_admin',
  'get_user_tenant_id',
  'get_user_role',
  'check_client_limit',
  'check_user_limit',
  'set_cliente_tenant_id',
  'set_cliente_updated_by'
)
ORDER BY routine_name;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================

