-- Script de teste para verificar se as políticas RLS estão funcionando
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se RLS está habilitado
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('users', 'clientes');

-- 2. Listar todas as políticas ativas
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

-- 3. Teste básico de conectividade (deve funcionar sem erro)
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_clientes FROM clientes;

-- 4. Verificar se auth.uid() está funcionando
SELECT auth.uid() as current_user_id;

-- 5. Teste de isolamento (execute como usuário logado)
-- Estas consultas devem retornar apenas dados do usuário logado:
SELECT 
  id, 
  email, 
  company_name,
  role
FROM users 
WHERE id = auth.uid();

SELECT 
  id, 
  nome, 
  user_id,
  data_contato
FROM clientes 
WHERE user_id = auth.uid()
LIMIT 5;

-- 6. Verificar se há políticas conflitantes ou recursivas
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('users', 'clientes')
AND (qual LIKE '%users%' OR with_check LIKE '%users%')
ORDER BY tablename, policyname;
