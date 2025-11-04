-- =====================================================
-- ADICIONAR CAMPOS DE PAGAMENTO E NOTIFICAÇÕES
-- =====================================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- =====================================================

-- Adicionar campos de sinal de pagamento
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS pagou_sinal BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS valor_sinal DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS data_pagamento_sinal DATE DEFAULT NULL;

-- Adicionar campos de pagamento de venda
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS venda_paga BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS data_pagamento_venda DATE DEFAULT NULL;

-- Adicionar campo de data de lembrete para chamada
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS data_lembrete_chamada DATE DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN clientes.pagou_sinal IS 'Indica se o cliente pagou o sinal da venda';
COMMENT ON COLUMN clientes.valor_sinal IS 'Valor do sinal pago pelo cliente (parte do valor total)';
COMMENT ON COLUMN clientes.data_pagamento_sinal IS 'Data em que o sinal foi pago';
COMMENT ON COLUMN clientes.venda_paga IS 'Indica se a venda foi totalmente paga';
COMMENT ON COLUMN clientes.data_pagamento_venda IS 'Data em que a venda foi completamente paga';
COMMENT ON COLUMN clientes.data_lembrete_chamada IS 'Data para chamar o cliente novamente';

-- Criar índice para otimizar buscas por data de lembrete
CREATE INDEX IF NOT EXISTS idx_clientes_data_lembrete 
ON clientes(data_lembrete_chamada) 
WHERE data_lembrete_chamada IS NOT NULL;

-- Verificar se as colunas foram criadas
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'clientes' 
  AND column_name IN (
    'pagou_sinal', 
    'valor_sinal', 
    'data_pagamento_sinal',
    'venda_paga',
    'data_pagamento_venda',
    'data_lembrete_chamada'
  )
ORDER BY column_name;

-- =====================================================
-- Fim do script
-- =====================================================

