ALTER TABLE public.clientes
ADD COLUMN data_mes_venda date GENERATED ALWAYS AS (
  CASE
    WHEN resultado = 'Venda' THEN COALESCE(data_pagamento_sinal, data_contato)
    ELSE data_contato
  END
) STORED;

COMMENT ON COLUMN public.clientes.data_mes_venda IS 'Data usada para atribuir a venda a um mês/período: data_pagamento_sinal quando preenchida (e resultado = Venda), senão data_contato.';
