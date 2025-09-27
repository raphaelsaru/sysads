-- Script para verificar usuários existentes
-- Execute este script no SQL Editor do Supabase

-- Verificar usuários na tabela users
SELECT 
  id,
  email,
  company_name,
  role,
  currency,
  created_at
FROM users 
ORDER BY created_at DESC;

-- Verificar total de usuários
SELECT COUNT(*) as total_usuarios FROM users;

-- Verificar usuários por role
SELECT 
  role,
  COUNT(*) as quantidade
FROM users 
GROUP BY role;

-- Verificar se há usuários admin
SELECT 
  id,
  email,
  company_name,
  role
FROM users 
WHERE role = 'admin';

-- Verificar políticas RLS atuais
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
