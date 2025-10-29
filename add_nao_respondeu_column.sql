-- =====================================================
-- ADICIONAR CAMPO NAO_RESPONDEU NA TABELA CLIENTES
-- =====================================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- =====================================================

-- Adicionar coluna nao_respondeu na tabela clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS nao_respondeu BOOLEAN DEFAULT false NOT NULL;

-- Verificar se a coluna foi criada
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'clientes' 
  AND column_name = 'nao_respondeu';

-- =====================================================
-- Fim do script
-- =====================================================

