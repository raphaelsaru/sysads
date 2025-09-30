-- =====================================================
-- SETUP ADMIN - POLÍTICAS RLS SIMPLES E FUNCIONAIS
-- =====================================================
-- 
-- Este script configura as políticas RLS (Row Level Security) para permitir que:
-- 1. Admins vejam todos os dados de todos os usuários
-- 2. Usuários normais vejam apenas seus próprios dados
-- 
-- Execute este script no SQL Editor do Supabase Dashboard
-- =====================================================

-- Limpar políticas antigas se existirem
DROP POLICY IF EXISTS "users_select_own_or_admin" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own_or_admin" ON users;
DROP POLICY IF EXISTS "clientes_select_own_or_admin" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_own" ON clientes;
DROP POLICY IF EXISTS "clientes_update_own_or_admin" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_own_or_admin" ON clientes;

-- =====================================================
-- POLÍTICAS PARA TABELA USERS
-- =====================================================

-- Habilitar RLS na tabela users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuários veem seu próprio perfil, admins veem todos
CREATE POLICY "users_select_own_or_admin" ON users
FOR SELECT
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- INSERT: Permitir inserção (necessário para signup)
CREATE POLICY "users_insert_own" ON users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- UPDATE: Usuários atualizam seus próprios dados, admins atualizam qualquer um
CREATE POLICY "users_update_own_or_admin" ON users
FOR UPDATE
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- =====================================================
-- POLÍTICAS PARA TABELA CLIENTES
-- =====================================================

-- Habilitar RLS na tabela clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuários veem seus próprios clientes, admins veem todos
CREATE POLICY "clientes_select_own_or_admin" ON clientes
FOR SELECT
USING (
  user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- INSERT: Usuários inserem clientes para si mesmos
CREATE POLICY "clientes_insert_own" ON clientes
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- UPDATE: Usuários atualizam seus próprios clientes, admins atualizam qualquer um
CREATE POLICY "clientes_update_own_or_admin" ON clientes
FOR UPDATE
USING (
  user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- DELETE: Usuários deletam seus próprios clientes, admins deletam qualquer um
CREATE POLICY "clientes_delete_own_or_admin" ON clientes
FOR DELETE
USING (
  user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Verificar se as políticas foram criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;

-- =====================================================
-- CRIAR UM USUÁRIO ADMIN
-- =====================================================
-- 
-- IMPORTANTE: Substitua 'seu-email@exemplo.com' pelo seu email real
-- Execute esta query APÓS fazer o signup no sistema
-- 
-- UPDATE users 
-- SET role = 'admin' 
-- WHERE email = 'seu-email@exemplo.com';
-- 
-- =====================================================

-- Fim do script
