-- =====================================================
-- MIGRAÇÃO DE TODOS OS CLIENTES PARA TENANT PRIZELY
-- Tenant ID: 8096819e-1349-4595-bfab-c998ad340ca7
-- =====================================================
-- ATENÇÃO: Execute esta query apenas se tiver certeza
-- que todos os clientes devem pertencer ao tenant Prizely
-- =====================================================

-- 1. Verificar quantos clientes serão migrados
SELECT 
  COUNT(*) as total_clientes,
  COUNT(DISTINCT tenant_id) as tenants_diferentes,
  COUNT(DISTINCT user_id) as usuarios_diferentes
FROM clientes;

-- 2. Verificar distribuição atual de clientes por tenant
SELECT 
  COALESCE(t.name, 'Sem tenant') as tenant_name,
  c.tenant_id,
  COUNT(*) as quantidade_clientes,
  COUNT(DISTINCT c.user_id) as usuarios_distintos
FROM clientes c
LEFT JOIN tenants t ON t.id = c.tenant_id
GROUP BY c.tenant_id, t.name
ORDER BY quantidade_clientes DESC;

-- 3. Verificar se o tenant Prizely existe
SELECT 
  id,
  name,
  slug,
  is_active
FROM tenants
WHERE id = '8096819e-1349-4595-bfab-c998ad340ca7';

-- 4. BACKUP: Criar tabela de backup antes de migrar
CREATE TABLE IF NOT EXISTS clientes_backup_before_migration AS
SELECT * FROM clientes;

-- 5. Verificar clientes que serão migrados (amostra)
SELECT 
  id,
  nome,
  user_id,
  tenant_id,
  created_at
FROM clientes
WHERE tenant_id IS NULL 
   OR tenant_id != '8096819e-1349-4595-bfab-c998ad340ca7'
ORDER BY created_at DESC
LIMIT 20;

-- 6. MIGRAÇÃO: Atualizar todos os clientes para o tenant Prizely
-- IMPORTANTE: Execute esta query apenas se confirmar que está correto
UPDATE clientes
SET 
  tenant_id = '8096819e-1349-4595-bfab-c998ad340ca7',
  updated_at = NOW()
WHERE tenant_id IS NULL 
   OR tenant_id != '8096819e-1349-4595-bfab-c998ad340ca7';

-- 7. Verificar se a migração foi bem-sucedida
SELECT 
  tenant_id,
  COUNT(*) as quantidade,
  COUNT(DISTINCT user_id) as usuarios_distintos
FROM clientes
GROUP BY tenant_id;

-- 8. Verificar se todos os clientes estão no tenant Prizely
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Todos os clientes estão no tenant Prizely'
    ELSE '⚠️ Ainda existem clientes fora do tenant Prizely: ' || COUNT(*)::text
  END as status_migracao
FROM clientes
WHERE tenant_id IS NULL 
   OR tenant_id != '8096819e-1349-4595-bfab-c998ad340ca7';

-- 9. Verificar se há clientes sem user_id (problema de integridade)
SELECT 
  COUNT(*) as clientes_sem_user_id
FROM clientes
WHERE user_id IS NULL;

-- 10. Verificar se há clientes órfãos (user_id que não existe em user_profiles)
SELECT 
  COUNT(*) as clientes_orfaos
FROM clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.id = c.user_id
);

-- =====================================================
-- OPCIONAL: Migrar também os usuários para o tenant Prizely
-- Execute apenas se todos os usuários devem estar no tenant Prizely
-- =====================================================

-- 11. Verificar distribuição atual de usuários por tenant
SELECT 
  COALESCE(t.name, 'Sem tenant') as tenant_name,
  up.tenant_id,
  COUNT(*) as quantidade_usuarios,
  COUNT(CASE WHEN up.role = 'admin_global' THEN 1 END) as admins_global,
  COUNT(CASE WHEN up.role = 'tenant_admin' THEN 1 END) as tenant_admins,
  COUNT(CASE WHEN up.role = 'tenant_user' THEN 1 END) as tenant_users
FROM user_profiles up
LEFT JOIN tenants t ON t.id = up.tenant_id
GROUP BY up.tenant_id, t.name
ORDER BY quantidade_usuarios DESC;

-- 12. OPCIONAL: Migrar usuários para o tenant Prizely
-- ATENÇÃO: Execute apenas se confirmar que todos devem estar no tenant Prizely
-- UPDATE user_profiles
-- SET tenant_id = '8096819e-1349-4595-bfab-c998ad340ca7'
-- WHERE tenant_id IS NULL 
--    OR tenant_id != '8096819e-1349-4595-bfab-c998ad340ca7';

