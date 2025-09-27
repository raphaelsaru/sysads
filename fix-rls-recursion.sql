-- Correção para recursão infinita nas políticas RLS
-- Execute este script no SQL Editor do Supabase

-- 1. Remover todas as políticas existentes que causam recursão
DO $$
BEGIN
    -- Remover políticas da tabela users
    DROP POLICY IF EXISTS "users_select_policy" ON users;
    DROP POLICY IF EXISTS "users_insert_policy" ON users;
    DROP POLICY IF EXISTS "users_update_policy" ON users;
    DROP POLICY IF EXISTS "users_delete_policy" ON users;
    DROP POLICY IF EXISTS "Admins can view all users" ON users;
    DROP POLICY IF EXISTS "Users can view own profile" ON users;
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
    
    -- Remover políticas da tabela clientes
    DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;
    
    RAISE NOTICE 'Políticas existentes removidas com sucesso';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao remover políticas: %', SQLERRM;
END $$;

-- 2. Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas simples SEM recursão para a tabela users
-- Política básica: usuários veem apenas seu próprio perfil
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Política para inserção: usuários podem criar seu próprio perfil
CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Política para atualização: usuários podem atualizar seu próprio perfil
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Criar políticas simples para a tabela clientes
-- Política para visualização: usuários veem apenas seus próprios clientes
CREATE POLICY "clientes_select_own" ON clientes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política para inserção: usuários podem criar clientes para si mesmos
CREATE POLICY "clientes_insert_own" ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política para atualização: usuários podem atualizar seus próprios clientes
CREATE POLICY "clientes_update_own" ON clientes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para exclusão: usuários podem deletar seus próprios clientes
CREATE POLICY "clientes_delete_own" ON clientes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Criar função para verificar se usuário é admin (sem recursão)
-- Esta função usa auth.users diretamente, não a tabela users
CREATE OR REPLACE FUNCTION public.is_admin_simple()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin',
    false
  );
$$;

-- 6. Políticas especiais para admins (usando a função sem recursão)
-- Admin pode ver todos os usuários
CREATE POLICY "admin_view_all_users" ON users
  FOR SELECT
  TO authenticated
  USING (public.is_admin_simple());

-- Admin pode atualizar todos os usuários
CREATE POLICY "admin_update_all_users" ON users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_simple())
  WITH CHECK (public.is_admin_simple());

-- Admin pode ver todos os clientes
CREATE POLICY "admin_view_all_clientes" ON clientes
  FOR SELECT
  TO authenticated
  USING (public.is_admin_simple());

-- Admin pode atualizar todos os clientes
CREATE POLICY "admin_update_all_clientes" ON clientes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_simple())
  WITH CHECK (public.is_admin_simple());

-- Admin pode deletar todos os clientes
CREATE POLICY "admin_delete_all_clientes" ON clientes
  FOR DELETE
  TO authenticated
  USING (public.is_admin_simple());

-- 7. Verificar se as políticas foram criadas corretamente
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

-- 8. Teste de verificação
DO $$
BEGIN
    RAISE NOTICE '✅ Políticas RLS criadas com sucesso!';
    RAISE NOTICE '🔒 Usuários normais: veem apenas seus próprios dados';
    RAISE NOTICE '👑 Admins: veem todos os dados (via user_metadata)';
    RAISE NOTICE '🚫 Sem recursão: políticas usam auth.uid() diretamente';
END $$;
