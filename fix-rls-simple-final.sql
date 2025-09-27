-- Correção simples e definitiva para políticas RLS
-- Execute este script no SQL Editor do Supabase

-- 1. Remover TODAS as políticas existentes
DO $$
BEGIN
    -- Remover políticas da tabela users
    DROP POLICY IF EXISTS "users_select_policy" ON users;
    DROP POLICY IF EXISTS "users_insert_policy" ON users;
    DROP POLICY IF EXISTS "users_update_policy" ON users;
    DROP POLICY IF EXISTS "users_delete_policy" ON users;
    DROP POLICY IF EXISTS "users_select_own" ON users;
    DROP POLICY IF EXISTS "users_insert_own" ON users;
    DROP POLICY IF EXISTS "users_update_own" ON users;
    DROP POLICY IF EXISTS "Admins can view all users" ON users;
    DROP POLICY IF EXISTS "Users can view own profile" ON users;
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
    DROP POLICY IF EXISTS "admin_view_all_users" ON users;
    DROP POLICY IF EXISTS "admin_update_all_users" ON users;
    
    -- Remover políticas da tabela clientes
    DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;
    DROP POLICY IF EXISTS "clientes_select_own" ON clientes;
    DROP POLICY IF EXISTS "clientes_insert_own" ON clientes;
    DROP POLICY IF EXISTS "clientes_update_own" ON clientes;
    DROP POLICY IF EXISTS "clientes_delete_own" ON clientes;
    DROP POLICY IF EXISTS "admin_view_all_clientes" ON clientes;
    DROP POLICY IF EXISTS "admin_update_all_clientes" ON clientes;
    DROP POLICY IF EXISTS "admin_delete_all_clientes" ON clientes;
    
    RAISE NOTICE '✅ Todas as políticas existentes removidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro ao remover políticas: %', SQLERRM;
END $$;

-- 2. Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas MUITO simples para users
-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "users_own_profile" ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Criar políticas MUITO simples para clientes
-- Usuários podem ver apenas seus próprios clientes
CREATE POLICY "clientes_own_data" ON clientes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Verificar se as políticas foram criadas
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
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;

-- 6. Teste de verificação
DO $$
BEGIN
    RAISE NOTICE '✅ Políticas RLS criadas com sucesso!';
    RAISE NOTICE '🔒 Cada usuário vê apenas seus próprios dados';
    RAISE NOTICE '🚫 Sem recursão: políticas usam auth.uid() diretamente';
    RAISE NOTICE '⚡ Sistema deve funcionar normalmente agora';
END $$;
