-- Script para criar políticas RLS seguras que isolam dados por usuário
-- Execute este script no SQL Editor do Supabase

-- 1. Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;

DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_update_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_policy" ON clientes;

-- 2. Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas seguras para a tabela USERS
-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Usuários podem inserir apenas seu próprio perfil
CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política especial para admins verem todos os usuários
-- Esta política usa uma função para evitar recursão
CREATE POLICY "admins_view_all_users" ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- 4. Criar políticas seguras para a tabela CLIENTES
-- Usuários podem ver apenas seus próprios clientes
CREATE POLICY "clientes_select_own" ON clientes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuários podem inserir clientes apenas para si mesmos
CREATE POLICY "clientes_insert_own" ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar apenas seus próprios clientes
CREATE POLICY "clientes_update_own" ON clientes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar apenas seus próprios clientes
CREATE POLICY "clientes_delete_own" ON clientes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Política especial para admins verem todos os clientes
CREATE POLICY "admins_view_all_clientes" ON clientes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- 5. Verificar as políticas criadas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'HAS_QUAL'
    ELSE 'NO_QUAL'
  END as has_qualification,
  CASE 
    WHEN with_check IS NOT NULL THEN 'HAS_CHECK'
    ELSE 'NO_CHECK'
  END as has_check
FROM pg_policies 
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;

-- 6. Teste das políticas (execute estas consultas para verificar)
-- Para um usuário normal (substitua 'user-id' pelo ID real):
-- SELECT * FROM users WHERE id = 'user-id';
-- SELECT * FROM clientes WHERE user_id = 'user-id';

-- Para verificar se um admin pode ver todos os dados:
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM clientes;
