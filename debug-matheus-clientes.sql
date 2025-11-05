-- Query para investigar clientes do Matheus (ID: 30380fc8-e0e9-412f-be20-7ecc40bd5ce8)

-- 1. Verificar se o usuário existe e seus dados
SELECT 
  up.id,
  au.email,
  up.role,
  up.tenant_id,
  up.full_name,
  t.name as tenant_name
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
LEFT JOIN tenants t ON t.id = up.tenant_id
WHERE up.id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8';

-- 2. Contar total de clientes do Matheus
SELECT COUNT(*) as total_clientes
FROM clientes
WHERE user_id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8';

-- 3. Ver todos os clientes do Matheus
SELECT 
  id,
  nome,
  data_contato,
  user_id,
  tenant_id,
  created_at,
  created_by
FROM clientes
WHERE user_id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Verificar se há clientes sem user_id (problema de migração)
SELECT COUNT(*) as clientes_sem_user_id
FROM clientes
WHERE user_id IS NULL;

-- 5. Verificar tenant_id dos clientes do Matheus
SELECT 
  tenant_id,
  COUNT(*) as quantidade
FROM clientes
WHERE user_id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8'
GROUP BY tenant_id;

-- 6. Verificar seu próprio perfil (para comparar)
-- Substitua 'SEU_EMAIL' pelo seu email
SELECT 
  up.id,
  au.email,
  up.tenant_id,
  up.role,
  t.name as tenant_name
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
LEFT JOIN tenants t ON t.id = up.tenant_id
WHERE au.email = 'SEU_EMAIL'; -- Substitua pelo seu email

-- 7. Verificar se você é admin e pode ver clientes de outros tenants
SELECT 
  up.id,
  au.email,
  up.role,
  up.tenant_id,
  CASE 
    WHEN up.role = 'admin_global' THEN 'Pode ver todos os clientes'
    WHEN up.role = 'tenant_admin' THEN 'Pode ver apenas clientes do seu tenant'
    ELSE 'Pode ver apenas seus próprios clientes'
  END as permissoes
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
WHERE au.email = 'SEU_EMAIL'; -- Substitua pelo seu email

