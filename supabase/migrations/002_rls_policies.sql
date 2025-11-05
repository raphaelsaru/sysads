-- =====================================================
-- RLS POLICIES - SISTEMA MULTITENANT
-- =====================================================
-- Policies para garantir isolamento de dados por tenant
-- e controle de acesso por roles
-- =====================================================

-- =====================================================
-- PASSO 1: REMOVER POLICIES ANTIGAS
-- =====================================================

-- Remover policies antigas da tabela users (não usaremos mais)
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own_or_admin" ON public.users;

-- Remover policies antigas de clientes
DROP POLICY IF EXISTS "clientes_select_own_or_admin" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert_own" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update_own_or_admin" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_own_or_admin" ON public.clientes;

-- =====================================================
-- PASSO 2: POLICIES PARA TENANTS
-- =====================================================

-- Remover policies existentes antes de criar
DROP POLICY IF EXISTS "Admin Global tem acesso total aos tenants" ON public.tenants;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio tenant" ON public.tenants;
DROP POLICY IF EXISTS "Tenant Admin pode atualizar seu próprio tenant" ON public.tenants;

-- Admin Global: Acesso total a todos os tenants
CREATE POLICY "Admin Global tem acesso total aos tenants"
ON public.tenants
FOR ALL
USING (public.is_admin_global())
WITH CHECK (public.is_admin_global());

-- Usuários: Podem ver seu próprio tenant
CREATE POLICY "Usuários podem ver seu próprio tenant"
ON public.tenants
FOR SELECT
USING (id = public.get_user_tenant_id());

-- Tenant Admin: Pode atualizar seu próprio tenant (apenas branding e settings)
CREATE POLICY "Tenant Admin pode atualizar seu próprio tenant"
ON public.tenants
FOR UPDATE
USING (
  id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
)
WITH CHECK (
  id = public.get_user_tenant_id() 
  AND public.is_tenant_admin()
);

-- =====================================================
-- PASSO 3: POLICIES PARA USER_PROFILES
-- =====================================================

-- Remover policies existentes antes de criar
DROP POLICY IF EXISTS "Admin Global tem acesso total aos perfis" ON public.user_profiles;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.user_profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.user_profiles;
DROP POLICY IF EXISTS "Tenant Admin pode gerenciar usuários do tenant" ON public.user_profiles;

-- Admin Global: Acesso total a todos os perfis
CREATE POLICY "Admin Global tem acesso total aos perfis"
ON public.user_profiles
FOR ALL
USING (public.is_admin_global())
WITH CHECK (public.is_admin_global());

-- Usuários: Podem ver seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.user_profiles
FOR SELECT
USING (id = auth.uid());

-- Usuários: Podem atualizar seu próprio perfil (mas não role nem tenant_id)
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.user_profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() 
  AND tenant_id = (
    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
  )
  AND role = (
    SELECT role FROM public.user_profiles WHERE id = auth.uid()
  )
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
-- PASSO 4: POLICIES PARA CLIENTES
-- =====================================================

-- Remover policies existentes antes de criar
DROP POLICY IF EXISTS "Admin Global tem acesso total aos clientes" ON public.clientes;
DROP POLICY IF EXISTS "Tenant User pode ver clientes do tenant" ON public.clientes;
DROP POLICY IF EXISTS "Tenant User pode criar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Tenant User pode atualizar seus próprios clientes" ON public.clientes;
DROP POLICY IF EXISTS "Tenant User pode deletar seus próprios clientes" ON public.clientes;
DROP POLICY IF EXISTS "Tenant Admin pode gerenciar clientes do tenant" ON public.clientes;

-- Admin Global: Acesso total a todos os clientes
CREATE POLICY "Admin Global tem acesso total aos clientes"
ON public.clientes
FOR ALL
USING (public.is_admin_global())
WITH CHECK (public.is_admin_global());

-- Tenant User: Pode ver todos os clientes do seu tenant
CREATE POLICY "Tenant User pode ver clientes do tenant"
ON public.clientes
FOR SELECT
USING (tenant_id = public.get_user_tenant_id());

-- Tenant User: Pode criar clientes no seu tenant (respeitando limite)
CREATE POLICY "Tenant User pode criar clientes"
ON public.clientes
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.check_client_limit(tenant_id)
);

-- Tenant User: Pode atualizar seus próprios clientes
CREATE POLICY "Tenant User pode atualizar seus próprios clientes"
ON public.clientes
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND created_by = auth.uid()
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND created_by = auth.uid()
);

-- Tenant User: Pode deletar seus próprios clientes
CREATE POLICY "Tenant User pode deletar seus próprios clientes"
ON public.clientes
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND created_by = auth.uid()
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

-- =====================================================
-- PASSO 5: HABILITAR RLS NAS TABELAS
-- =====================================================

-- Garantir que RLS está habilitado
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Manter tabela users com RLS mas sem policies (será deprecada)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASSO 6: GRANT PERMISSIONS
-- =====================================================

-- Garantir que authenticated users podem acessar as tabelas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;

-- Garantir que authenticated users podem usar as funções
GRANT EXECUTE ON FUNCTION public.is_admin_global() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_client_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_limit(uuid) TO authenticated;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Listar todas as policies criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'user_profiles', 'clientes')
ORDER BY tablename, policyname;

-- Verificar RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'user_profiles', 'clientes', 'users')
ORDER BY tablename;

-- =====================================================
-- FIM DAS POLICIES RLS
-- =====================================================

