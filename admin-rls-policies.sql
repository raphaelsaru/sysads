-- Políticas RLS para permitir que administradores vejam todos os usuários e clientes
-- Execute este SQL no Supabase SQL Editor

-- 1. Habilitar RLS nas tabelas (se ainda não estiver habilitado)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON users;
DROP POLICY IF EXISTS "Users can update own profile, admins can update all" ON users;
DROP POLICY IF EXISTS "Only admins can insert users" ON users;
DROP POLICY IF EXISTS "Users can view own clients, admins can view all" ON clientes;
DROP POLICY IF EXISTS "Users can insert own clients, admins can insert for anyone" ON clientes;
DROP POLICY IF EXISTS "Users can update own clients, admins can update all" ON clientes;
DROP POLICY IF EXISTS "Users can delete own clients, admins can delete all" ON clientes;
DROP POLICY IF EXISTS "Admin full access to users" ON users;
DROP POLICY IF EXISTS "Admin full access to clientes" ON clientes;

-- 3. Política para tabela 'users' - usuários podem ver apenas seu próprio perfil, admins podem ver todos
CREATE POLICY "Users can view own profile, admins can view all" ON users
FOR SELECT
USING (
  -- Usuário pode ver seu próprio perfil
  auth.uid() = id 
  OR 
  -- Admin pode ver todos os perfis
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 4. Política para tabela 'users' - usuários podem atualizar apenas seu próprio perfil, admins podem atualizar todos
CREATE POLICY "Users can update own profile, admins can update all" ON users
FOR UPDATE
USING (
  -- Usuário pode atualizar seu próprio perfil
  auth.uid() = id 
  OR 
  -- Admin pode atualizar todos os perfis
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 5. Política para tabela 'users' - apenas admins podem inserir novos usuários
CREATE POLICY "Only admins can insert users" ON users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 6. Política para tabela 'clientes' - usuários podem ver apenas seus próprios clientes, admins podem ver todos
CREATE POLICY "Users can view own clients, admins can view all" ON clientes
FOR SELECT
USING (
  -- Usuário pode ver seus próprios clientes
  auth.uid() = user_id 
  OR 
  -- Admin pode ver todos os clientes
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 7. Política para tabela 'clientes' - usuários podem inserir apenas para si mesmos, admins podem inserir para qualquer usuário
CREATE POLICY "Users can insert own clients, admins can insert for anyone" ON clientes
FOR INSERT
WITH CHECK (
  -- Usuário pode inserir clientes para si mesmo
  auth.uid() = user_id 
  OR 
  -- Admin pode inserir clientes para qualquer usuário
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 8. Política para tabela 'clientes' - usuários podem atualizar apenas seus próprios clientes, admins podem atualizar todos
CREATE POLICY "Users can update own clients, admins can update all" ON clientes
FOR UPDATE
USING (
  -- Usuário pode atualizar seus próprios clientes
  auth.uid() = user_id 
  OR 
  -- Admin pode atualizar todos os clientes
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 9. Política para tabela 'clientes' - usuários podem deletar apenas seus próprios clientes, admins podem deletar todos
CREATE POLICY "Users can delete own clients, admins can delete all" ON clientes
FOR DELETE
USING (
  -- Usuário pode deletar seus próprios clientes
  auth.uid() = user_id 
  OR 
  -- Admin pode deletar todos os clientes
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 10. Política adicional para garantir que admins sempre tenham acesso (fallback)
CREATE POLICY "Admin full access to users" ON users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admin full access to clientes" ON clientes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Verificar se as políticas foram criadas corretamente
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
