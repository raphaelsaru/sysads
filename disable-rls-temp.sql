-- Script para desabilitar RLS temporariamente e resolver o problema de recursão
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

-- 2. Desabilitar RLS temporariamente
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- 3. Verificar se as tabelas estão acessíveis agora
-- Execute estas consultas para testar:
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM clientes;

-- IMPORTANTE: 
-- Este script desabilita temporariamente o RLS para resolver o problema de recursão.
-- Depois que a aplicação estiver funcionando, você pode reabilitar o RLS com políticas mais simples.
-- Para reabilitar o RLS mais tarde, execute:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
