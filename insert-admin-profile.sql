-- Script para inserir perfil do usuário admin
-- Execute este script no SQL Editor do Supabase

-- Inserir perfil do usuário admin na tabela users
INSERT INTO users (
  id,
  email,
  company_name,
  role,
  currency,
  created_at,
  updated_at
) VALUES (
  '79c9a1c8-f938-48e7-a11f-ebfbbefa8fe7',
  'admin@prizely.com',
  'Prizely Admin',
  'admin',
  'BRL',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  company_name = EXCLUDED.company_name,
  role = EXCLUDED.role,
  currency = EXCLUDED.currency,
  updated_at = NOW();

-- Verificar se o usuário foi inserido
SELECT 
  id,
  email,
  company_name,
  role,
  currency,
  created_at
FROM users 
WHERE id = '79c9a1c8-f938-48e7-a11f-ebfbbefa8fe7';

-- Verificar total de usuários
SELECT COUNT(*) as total_usuarios FROM users;
