-- =====================================================
-- Migration: Adicionar Feature Flag para OCR Instagram
-- =====================================================
-- Descrição: Adiciona campo para controlar a feature de OCR
-- do Instagram nas settings dos tenants

-- Função helper para verificar se um tenant tem OCR Instagram habilitado
CREATE OR REPLACE FUNCTION has_ocr_instagram_enabled(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT (settings->>'ocr_instagram_enabled')::boolean
      FROM tenants
      WHERE id = tenant_uuid
      AND is_active = true
    ),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário na função
COMMENT ON FUNCTION has_ocr_instagram_enabled(UUID) IS 
'Verifica se um tenant tem a feature de OCR Instagram habilitada';

-- Adicionar índice para melhorar performance de queries nas settings
CREATE INDEX IF NOT EXISTS idx_tenants_settings_ocr 
ON tenants USING gin(settings);

-- Comentário sobre o campo settings
COMMENT ON COLUMN tenants.settings IS 
'Configurações do tenant em formato JSON. 
Campos disponíveis:
- ocr_instagram_enabled (boolean): Habilita importação via OCR de screenshots do Instagram Direct';

-- Função para atualizar settings do tenant de forma segura
CREATE OR REPLACE FUNCTION update_tenant_settings(
  tenant_uuid UUID,
  setting_key TEXT,
  setting_value JSONB
)
RETURNS JSONB AS $$
DECLARE
  current_settings JSONB;
  updated_settings JSONB;
BEGIN
  -- Buscar settings atuais
  SELECT COALESCE(settings, '{}'::jsonb) INTO current_settings
  FROM tenants
  WHERE id = tenant_uuid;
  
  -- Atualizar apenas a chave específica
  updated_settings := current_settings || jsonb_build_object(setting_key, setting_value);
  
  -- Atualizar no banco
  UPDATE tenants
  SET settings = updated_settings,
      updated_at = NOW()
  WHERE id = tenant_uuid;
  
  RETURN updated_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário na função
COMMENT ON FUNCTION update_tenant_settings(UUID, TEXT, JSONB) IS 
'Atualiza uma chave específica nas settings do tenant de forma segura';

