-- Script simplificado para corrigir políticas RLS
-- Execute este script no SQL Editor do Supabase

-- 1. Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;

DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;

-- 2. Temporariamente desabilitar RLS para testar
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- 3. Verificar se as tabelas estão acessíveis
-- (Execute estas consultas para testar)
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM clientes;

-- 4. Se as consultas acima funcionarem, reabilitar RLS com políticas simples
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas básicas sem recursão
CREATE POLICY "users_select_policy" ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "clientes_select_policy" ON clientes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "clientes_insert_policy" ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "clientes_update_policy" ON clientes
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "clientes_delete_policy" ON clientes
  FOR DELETE
  TO authenticated
  USING (true);

-- 6. Verificar políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;
