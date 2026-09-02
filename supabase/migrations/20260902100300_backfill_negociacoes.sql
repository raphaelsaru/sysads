insert into public.negociacoes (
  cliente_id, tenant_id, data_contato, orcamento_enviado, resultado,
  qualidade_contato, nao_respondeu, valor_fechado, pagou_sinal, valor_sinal,
  data_pagamento_sinal, venda_paga, data_pagamento_venda, data_lembrete_chamada,
  observacao, created_at, updated_at, created_by, updated_by
)
select
  id, tenant_id, data_contato, orcamento_enviado, resultado,
  qualidade_contato, nao_respondeu, valor_fechado, pagou_sinal, valor_sinal,
  data_pagamento_sinal, venda_paga, data_pagamento_venda, data_lembrete_chamada,
  observacao, created_at, updated_at, created_by, updated_by
from public.clientes;
