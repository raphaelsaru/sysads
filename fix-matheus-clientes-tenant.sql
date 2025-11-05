-- Script para corrigir tenant_id dos clientes do Matheus
-- ID do Matheus: 30380fc8-e0e9-412f-be20-7ecc40bd5ce8
-- Tenant correto: 8096819e-1349-4595-bfab-c998ad340ca7

-- 1. Verificar tenant_id atual do Matheus
SELECT 
  up.id,
  au.email,
  up.tenant_id,
  t.name as tenant_name
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
LEFT JOIN tenants t ON t.id = up.tenant_id
WHERE up.id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8';

-- 2. Verificar clientes que precisam ser migrados
SELECT 
  id,
  nome,
  data_contato,
  tenant_id,
  created_at
FROM clientes
WHERE user_id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8'
  AND tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC;

-- 3. ATENÇÃO: Execute esta query apenas se confirmar que o tenant correto é 8096819e-1349-4595-bfab-c998ad340ca7
-- Migrar clientes do tenant padrão para o tenant correto do Matheus
UPDATE clientes
SET 
  tenant_id = '8096819e-1349-4595-bfab-c998ad340ca7',
  updated_at = NOW(),
  updated_by = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8'
WHERE user_id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8'
  AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- 4. Verificar se a migração foi bem-sucedida
SELECT 
  tenant_id,
  COUNT(*) as quantidade
FROM clientes
WHERE user_id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8'
GROUP BY tenant_id;

-- 5. Verificar se o Matheus está no tenant correto
-- Se não estiver, você precisará atualizar o user_profiles também
UPDATE user_profiles
SET tenant_id = '8096819e-1349-4595-bfab-c998ad340ca7'
WHERE id = '30380fc8-e0e9-412f-be20-7ecc40bd5ce8'
  AND tenant_id != '8096819e-1349-4595-bfab-c998ad340ca7';

