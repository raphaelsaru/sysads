-- Script para corrigir políticas RLS que estão causando recursão infinita
-- Execute este script no SQL Editor do Supabase

-- 1. Remover todas as políticas existentes da tabela users
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;

-- 2. Remover todas as políticas existentes da tabela clientes
DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;

-- 3. Criar políticas simples e seguras para a tabela users
-- Política para permitir que usuários vejam apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Política para permitir que usuários atualizem apenas seu próprio perfil
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Política para permitir inserção de novos usuários
CREATE POLICY "Enable insert for authenticated users only" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Política especial para admins verem todos os usuários (sem recursão)
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- 4. Criar políticas simples e seguras para a tabela clientes
-- Política para permitir que usuários vejam apenas seus próprios clientes
CREATE POLICY "Users can view own clientes" ON clientes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política para permitir que usuários insiram clientes para si mesmos
CREATE POLICY "Users can insert own clientes" ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política para permitir que usuários atualizem apenas seus próprios clientes
CREATE POLICY "Users can update own clientes" ON clientes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Política para permitir que usuários deletem apenas seus próprios clientes
CREATE POLICY "Users can delete own clientes" ON clientes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Verificar se RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 6. Verificar as políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;
