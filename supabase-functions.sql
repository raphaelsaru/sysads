-- Função para buscar todos os usuários para administradores
-- Esta função deve ser executada no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
  id uuid,
  company_name text,
  email text,
  currency text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Retornar todos os usuários
  RETURN QUERY
  SELECT 
    u.id,
    u.company_name,
    u.email,
    u.currency,
    u.role,
    u.created_at,
    u.updated_at
  FROM users u
  ORDER BY u.created_at ASC;
END;
$$;

-- Conceder permissões para a função
GRANT EXECUTE ON FUNCTION get_all_users_for_admin() TO authenticated;

-- Política RLS para permitir que admins vejam todos os usuários
-- (opcional, caso queira usar políticas RLS em vez da função)

-- Primeiro, remover políticas existentes se houver
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Criar política para admins
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user
      WHERE admin_user.id = auth.uid()
      AND admin_user.role = 'admin'
    )
  );

-- Habilitar RLS na tabela users se não estiver habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
