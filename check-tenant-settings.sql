-- Verificar settings do tenant Prizely
SELECT 
  id,
  name,
  settings,
  settings::text as settings_text,
  jsonb_typeof(settings) as settings_type
FROM tenants
WHERE name = 'Prizely' OR slug = 'prizely';
