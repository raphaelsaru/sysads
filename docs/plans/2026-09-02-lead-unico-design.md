# Lead único + página exclusiva do lead — design

Data: 2026-09-02

## Problema

Hoje `clientes` mistura pessoa + uma única negociação (resultado, orçamento,
valor, datas de pagamento tudo em campos singulares na mesma linha). Não há
checagem de duplicado na criação — a migration `20260822130000_lead_dedup_advisory_lock.sql`
documenta que isso é **proposital**: o time recria lead pro mesmo contato
quando ele volta a falar depois de dias/semanas. Isso deixa de ser necessário
com o modelo novo (retorno = nova negociação no mesmo lead).

## 1. Modelo de dados

`clientes` perde os campos de negociação única e vira só dados da pessoa:
`nome`, `whatsappInstagram`, `origem` (1ª captura), `dataContato` (1º
contato), `categoria`, `observacao` geral, `created_by/updated_by`, mais duas
colunas novas: `telefone_normalizado`, `instagram_normalizado`.

`negociacoes` (nova tabela, FK `cliente_id`): `id`, `clienteId`,
`dataContato`, `orcamentoEnviado`, `resultado`, `qualidadeContato`,
`naoRespondeu`, `valorFechado*`, `pagouSinal`, `valorSinal*`,
`dataPagamentoSinal`, `vendaPaga`, `dataPagamentoVenda`, `observacao`,
`createdAt/By`. Cada linha = uma negociação/orçamento/venda no tempo.

`followups` continua igual (FK `clienteId`), agora histórico da pessoa.

**LTV** = soma de `valorFechado` das negociações com `resultado = 'Venda'`.

Impacto: `useClientes`, API `clientes/*`, `ClienteForm`, `ClienteModal`,
`ClienteTable`, `dashboard/page.tsx` (KPIs leem `resultado`/`valorFechado`
direto de `Cliente` hoje).

## 2. Dedup — normalização e checagem

Normalização (SQL + TS compartilhado):
- Telefone: só dígitos, remove DDI 55 se sobrar, compara DDD+número.
- Instagram: extrai `@handle`, lowercase, sem `@`.
- `whatsappInstagram` (texto livre) tenta extrair telefone OU handle pra
  popular as colunas normalizadas.

Constraints: índice único parcial em `clientes(telefone_normalizado)` e outro
em `clientes(instagram_normalizado)` (`where not null`).

Checagem na criação (manual, webhook, OCR): normaliza o identificador e busca
match em qualquer um dos dois campos.
- Webhook/OCR: acha → cria negociação nova pro cliente existente, não cria
  pessoa nova.
- Form manual: acha → bloqueia com aviso "lead já existe" + link pro
  cadastro existente.

`create_lead_dedup` (function atual, dedup só por `user_id + identificador +
origem` via advisory lock) é substituída por `find_or_create_cliente`: acha
pessoa por normalizado; se não achar, cria pessoa + 1ª negociação juntos
(mesmo lock, chave normalizada).

`OCRDetectedUser.isDuplicate/existingClientId` passa a usar a mesma
normalização.

## 3. Merge de duplicados existentes

Migration one-off, roda **antes** de criar as constraints únicas:

1. Popula `telefone_normalizado`/`instagram_normalizado` em todas as linhas.
2. Agrupa por `telefone_normalizado` e por `instagram_normalizado`
   (ignorando nulos) — clusters com >1 linha = duplicados.
3. Canônico = `id` com menor `created_at` do cluster.
4. Toda linha do cluster (incluindo a canônica) vira uma negociação ligada
   ao canônico — já que hoje toda linha de `clientes` carrega dados de
   negociação misturados.
5. `followups.cliente_id` dos duplicados repontado pro canônico.
6. Linhas duplicadas apagadas de `clientes`.
7. Cria as constraints únicas parciais.
8. Log (`raise notice`) com nº de clusters e linhas mescladas.

Borda: telefone bate mas insta diverge (ou vice-versa) entre membros do
cluster — mescla igual (telefone OU insta = mesma pessoa). Nome final =
nome do registro mais antigo; nomes divergentes não se perdem (visíveis por
negociação se necessário, sem campo de "apelidos").

## 4. API

- `GET/POST /api/negociacoes` (`?clienteId=`), `PATCH/DELETE /api/negociacoes/[id]`.
- `POST /api/clientes`: normaliza, checa duplicado antes de inserir; se
  achar, 409 com `existingClientId`. Payload não recebe mais campos de
  negociação.
- `GET /api/clientes/[id]`: inclui `negociacoes` + `totalFollowUps` via join.
- Webhook/OCR batch trocam `create_lead_dedup` por `find_or_create_cliente`.

## 5. Página `/clientes/[id]`

- Header: nome, whatsapp/insta, origem, data 1º contato, categoria.
- KPIs: LTV, nº negociações, nº vendas fechadas, data última interação.
- Timeline: negociações (expansíveis) + follow-ups intercalados, desc.
- Botão "Nova negociação" (form ligado a `negociacoes`).
- Editar dados da pessoa em form separado, sem campos de negociação.
- `ClienteTable`: clique na linha navega pra cá (substitui `ClienteModal`
  como fluxo de edição). Coluna resultado/valor mostra dado da negociação
  mais recente (assunção — ver pergunta em aberto).

## Perguntas em aberto

- Coluna resultado/valor da `ClienteTable` (e filtros que dependem dela): uso
  a negociação mais recente como default. Confirmar se é isso mesmo ou se
  deveria ser "pior caso" / soma / outra regra.
- Filtros/KPIs do dashboard que hoje leem `Cliente.resultado` direto:
  recalcular em cima de `negociacoes` — precisa validar se período do
  dashboard filtra por `dataContato` do cliente ou da negociação.
- `ClienteModal` — mantém pra criação rápida de negociação a partir da
  tabela, ou tudo migra pra dentro da página do lead?
