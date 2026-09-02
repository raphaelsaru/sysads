create unique index clientes_telefone_normalizado_uidx
  on public.clientes(user_id, telefone_normalizado) where telefone_normalizado is not null;

create unique index clientes_instagram_normalizado_uidx
  on public.clientes(user_id, instagram_normalizado) where instagram_normalizado is not null;

alter table public.clientes
  drop column data_mes_venda,
  drop column orcamento_enviado,
  drop column resultado,
  drop column qualidade_contato,
  drop column nao_respondeu,
  drop column valor_fechado,
  drop column pagou_sinal,
  drop column valor_sinal,
  drop column data_pagamento_sinal,
  drop column venda_paga,
  drop column data_pagamento_venda,
  drop column data_lembrete_chamada;
