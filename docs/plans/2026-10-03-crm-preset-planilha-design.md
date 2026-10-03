# Preset "planilha" (DNA4, Concept Studio, Travizan Midias)

Empresas que vinham de CRM em planilha (modelo Fernando Tampa) ganham campos/opções extras.
Prizely e demais empresas não mudam.

## Banco
- `tenants.crm_preset text` (null = padrão; `'planilha'`).
- `negociacoes`: `procedimento`, `motivo_nao_venda`, `forma_pagamento_sinal` (text). Auditados.
- Enum `origem_tipo` + `TikTok`, `WhatsApp Studio`, `Cliente ativo`, `Cliente de Porta`.
  Organico (instagram) → `Orgânico / Perfil`; Anuncio → `Anúncio` (Meta CAPI continua).
- `resultado` + `Formulário`, `Consulta Presencial` (contam como em processo), `Cancelado` (conta como não venda).
- `dashboard_resumo` devolve `procedimentos`/`motivos` [{nome, qtd}]; contadores com os resultados novos.

## App
- `src/lib/crm-preset.ts`: `opcoesCrm(preset)` com todas as listas; padrão = listas atuais.
- Forms: Procedimento sempre; Motivo quando resultado ≠ Venda; Forma pgto quando pagou sinal.
- Dashboard: 2 gráficos de barra (Procedimento, Motivo Não Venda) só c/ preset.
- Sem importação do histórico da planilha. Preset ligado via SQL (sem tela).
