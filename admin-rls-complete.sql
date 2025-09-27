-- Políticas RLS completas para administradores
-- Execute este script no Supabase SQL Editor para dar permissões completas aos admins

-- 1. Primeiro, remover todas as políticas existentes para garantir limpeza
DO $$
BEGIN
    -- Remover políticas da tabela users
    DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON users;
    DROP POLICY IF EXISTS "Users can update own profile, admins can update all" ON users;
    DROP POLICY IF EXISTS "Only admins can insert users" ON users;
    DROP POLICY IF EXISTS "users_select_own" ON users;
    DROP POLICY IF EXISTS "users_insert_own" ON users;
    DROP POLICY IF EXISTS "users_update_own" ON users;
    DROP POLICY IF EXISTS "admins_view_all_users" ON users;
    DROP POLICY IF EXISTS "Admins can view all users" ON users;
    DROP POLICY IF EXISTS "Users can view own profile" ON users;
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;

    -- Remover políticas da tabela clientes
    DROP POLICY IF EXISTS "Users can view own clients, admins can view all" ON clientes;
    DROP POLICY IF EXISTS "Users can insert own clients, admins can insert for anyone" ON clientes;
    DROP POLICY IF EXISTS "Users can update own clients, admins can update all" ON clientes;
    DROP POLICY IF EXISTS "Users can delete own clients, admins can delete all" ON clientes;
    DROP POLICY IF EXISTS "clientes_select_own" ON clientes;
    DROP POLICY IF EXISTS "clientes_insert_own" ON clientes;
    DROP POLICY IF EXISTS "clientes_update_own" ON clientes;
    DROP POLICY IF EXISTS "clientes_delete_own" ON clientes;
    DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;
    DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;
    
    RAISE NOTICE 'Políticas existentes removidas com sucesso';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao remover políticas: %', SQLERRM;
END $$;

-- 2. Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 3. Criar função auxiliar para verificar se usuário é admin
-- Esta função evita recursão nas políticas RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 4. Políticas para tabela USERS

-- Política de SELECT: usuários veem próprio perfil, admins veem todos
CREATE POLICY "users_select_policy" ON users
  FOR SELECT
  TO authenticated
  USING (
    -- Usuário pode ver seu próprio perfil
    auth.uid() = id
    OR
    -- Ou se for admin, pode ver todos
    public.is_admin()
  );

-- Política de INSERT: apenas admins podem criar usuários (para sistema de gestão)
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Apenas admins podem inserir novos usuários
    public.is_admin()
    OR
    -- Ou o usuário está criando seu próprio perfil (signup)
    auth.uid() = id
  );

-- Política de UPDATE: usuários podem atualizar próprio perfil, admins podem atualizar qualquer um
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  TO authenticated
  USING (
    -- Usuário pode atualizar seu próprio perfil
    auth.uid() = id
    OR
    -- Ou se for admin, pode atualizar qualquer um
    public.is_admin()
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    auth.uid() = id
    OR
    public.is_admin()
  );

-- Política de DELETE: apenas admins podem deletar usuários
CREATE POLICY "users_delete_policy" ON users
  FOR DELETE
  TO authenticated
  USING (
    -- Apenas admins podem deletar usuários
    public.is_admin()
  );

-- 5. Políticas para tabela CLIENTES

-- Política de SELECT: usuários veem próprios clientes, admins veem todos
CREATE POLICY "clientes_select_policy" ON clientes
  FOR SELECT
  TO authenticated
  USING (
    -- Usuário pode ver seus próprios clientes
    auth.uid() = user_id
    OR
    -- Ou se for admin, pode ver todos os clientes
    public.is_admin()
  );

-- Política de INSERT: usuários podem inserir clientes para si, admins podem inserir para qualquer um
CREATE POLICY "clientes_insert_policy" ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Usuário pode inserir clientes para si mesmo
    auth.uid() = user_id
    OR
    -- Ou se for admin, pode inserir para qualquer usuário
    public.is_admin()
  );

-- Política de UPDATE: usuários podem atualizar próprios clientes, admins podem atualizar qualquer um
CREATE POLICY "clientes_update_policy" ON clientes
  FOR UPDATE
  TO authenticated
  USING (
    -- Usuário pode atualizar seus próprios clientes
    auth.uid() = user_id
    OR
    -- Ou se for admin, pode atualizar qualquer cliente
    public.is_admin()
  )
  WITH CHECK (
    -- Para admins, permitir mudar o user_id se necessário
    public.is_admin()
    OR
    -- Para usuários normais, só podem alterar seus próprios clientes
    auth.uid() = user_id
  );

-- Política de DELETE: usuários podem deletar próprios clientes, admins podem deletar qualquer um
CREATE POLICY "clientes_delete_policy" ON clientes
  FOR DELETE
  TO authenticated
  USING (
    -- Usuário pode deletar seus próprios clientes
    auth.uid() = user_id
    OR
    -- Ou se for admin, pode deletar qualquer cliente
    public.is_admin()
  );

-- 6. Criar função RPC para admins buscarem todos os usuários com estatísticas
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  id uuid,
  company_name text,
  email text,
  currency text,
  role text,
  created_at timestamptz,
  updated_at timestamptz,
  total_clientes bigint,
  total_vendas bigint,
  valor_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Retornar todos os usuários com estatísticas
  RETURN QUERY
  SELECT 
    u.id,
    u.company_name,
    u.email,
    u.currency,
    u.role,
    u.created_at,
    u.updated_at,
    COALESCE(stats.total_clientes, 0) as total_clientes,
    COALESCE(stats.total_vendas, 0) as total_vendas,
    COALESCE(stats.valor_total, 0) as valor_total
  FROM users u
  LEFT JOIN (
    SELECT 
      user_id,
      COUNT(*) as total_clientes,
      COUNT(CASE WHEN resultado = 'Venda' THEN 1 END) as total_vendas,
      COALESCE(SUM(CASE WHEN resultado = 'Venda' THEN valor_fechado ELSE 0 END), 0) as valor_total
    FROM clientes
    GROUP BY user_id
  ) stats ON u.id = stats.user_id
  ORDER BY u.created_at ASC;
END;
$$;

-- 7. Criar função RPC para admins buscarem clientes de um usuário específico
CREATE OR REPLACE FUNCTION get_user_clientes_admin(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  data_contato date,
  nome text,
  whatsapp_instagram text,
  origem text,
  orcamento_enviado boolean,
  resultado text,
  qualidade_contato text,
  valor_fechado numeric,
  observacao text,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Retornar todos os clientes do usuário especificado
  RETURN QUERY
  SELECT 
    c.id,
    c.data_contato,
    c.nome,
    c.whatsapp_instagram,
    c.origem,
    c.orcamento_enviado,
    c.resultado,
    c.qualidade_contato,
    c.valor_fechado,
    c.observacao,
    c.user_id
  FROM clientes c
  WHERE c.user_id = target_user_id
  ORDER BY c.data_contato DESC;
END;
$$;

-- 8. Conceder permissões para as funções
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_clientes_admin(uuid) TO authenticated;

-- 9. Verificar se as políticas foram aplicadas corretamente
DO $$
DECLARE
  users_rls boolean;
  clientes_rls boolean;
BEGIN
  -- Verificar RLS das tabelas de forma segura
  SELECT relrowsecurity INTO users_rls 
  FROM pg_class 
  WHERE relname = 'users' 
  LIMIT 1;
  
  SELECT relrowsecurity INTO clientes_rls 
  FROM pg_class 
  WHERE relname = 'clientes' 
  LIMIT 1;
  
  RAISE NOTICE '✅ Políticas RLS configuradas com sucesso!';
  RAISE NOTICE '📊 Tabelas com RLS habilitado:';
  RAISE NOTICE '  - users: %', COALESCE(users_rls::text, 'N/A');
  RAISE NOTICE '  - clientes: %', COALESCE(clientes_rls::text, 'N/A');
  RAISE NOTICE '🔧 Funções RPC criadas:';
  RAISE NOTICE '  - public.is_admin()';
  RAISE NOTICE '  - get_all_users_admin()';
  RAISE NOTICE '  - get_user_clientes_admin(uuid)';
  RAISE NOTICE '🎯 Agora administradores podem:';
  RAISE NOTICE '  - Ver todos os usuários e seus perfis';
  RAISE NOTICE '  - Ver todos os clientes de qualquer usuário';
  RAISE NOTICE '  - Criar, editar e deletar usuários';
  RAISE NOTICE '  - Criar, editar e deletar clientes de qualquer usuário';
END $$;
