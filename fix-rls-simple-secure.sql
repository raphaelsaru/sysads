-- Script simples e seguro para políticas RLS
-- Execute este script no SQL Editor do Supabase

-- 1. Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "admins_view_all_users" ON users;

DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_update_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_select_own" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_own" ON clientes;
DROP POLICY IF EXISTS "clientes_update_own" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_own" ON clientes;
DROP POLICY IF EXISTS "admins_view_all_clientes" ON clientes;

-- 2. Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas básicas usando auth.uid() diretamente (sem recursão)

-- POLÍTICAS PARA USERS
-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "users_own_select" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Usuários podem inserir apenas seu próprio perfil
CREATE POLICY "users_own_insert" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "users_own_update" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- POLÍTICAS PARA CLIENTES
-- Usuários podem ver apenas seus próprios clientes
CREATE POLICY "clientes_own_select" ON clientes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuários podem inserir clientes apenas para si mesmos
CREATE POLICY "clientes_own_insert" ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar apenas seus próprios clientes
CREATE POLICY "clientes_own_update" ON clientes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar apenas seus próprios clientes
CREATE POLICY "clientes_own_delete" ON clientes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Verificar as políticas criadas
SELECT 
  tablename, 
  policyname, 
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'HAS_QUAL'
    ELSE 'NO_QUAL'
  END as has_qualification
FROM pg_policies 
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;

-- 5. Teste básico (execute para verificar se não há recursão)
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM clientes;
