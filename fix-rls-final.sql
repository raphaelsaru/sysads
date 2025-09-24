-- Script final para corrigir políticas RLS e resolver problemas de timeout
-- Execute este script no SQL Editor do Supabase

-- 1. Remover TODAS as políticas existentes para começar limpo
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
DROP POLICY IF EXISTS "users_own_select" ON users;
DROP POLICY IF EXISTS "users_own_insert" ON users;
DROP POLICY IF EXISTS "users_own_update" ON users;

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
DROP POLICY IF EXISTS "clientes_own_select" ON clientes;
DROP POLICY IF EXISTS "clientes_own_insert" ON clientes;
DROP POLICY IF EXISTS "clientes_own_update" ON clientes;
DROP POLICY IF EXISTS "clientes_own_delete" ON clientes;

-- 2. Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas simples e eficazes para USERS
-- Política para SELECT: usuários veem apenas seu próprio perfil
CREATE POLICY "users_select_own_only" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Política para INSERT: usuários podem inserir apenas seu próprio perfil
CREATE POLICY "users_insert_own_only" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Política para UPDATE: usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "users_update_own_only" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Criar políticas simples e eficazes para CLIENTES
-- Política para SELECT: usuários veem apenas seus próprios clientes
CREATE POLICY "clientes_select_own_only" ON clientes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política para INSERT: usuários podem inserir clientes apenas para si mesmos
CREATE POLICY "clientes_insert_own_only" ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE: usuários podem atualizar apenas seus próprios clientes
CREATE POLICY "clientes_update_own_only" ON clientes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para DELETE: usuários podem deletar apenas seus próprios clientes
CREATE POLICY "clientes_delete_own_only" ON clientes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Verificar se as políticas foram criadas corretamente
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
  END as has_qualification
FROM pg_policies 
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;

-- 6. Teste básico para verificar se não há recursão
-- Execute estas consultas para verificar:
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM clientes;

-- 7. Verificar se RLS está funcionando
-- Para um usuário logado, estas consultas devem retornar apenas dados próprios:
-- SELECT * FROM users;
-- SELECT * FROM clientes;
