# Meta Conversions API — design

Base: `meta-events.md`. Validado em 2026-10-01.

## Decisões

- **Elegível**: negociação cujo cliente tem origem `Anúncio*` OU negociação com `meta_ad_id`.
- **Contact**: insert de negociação elegível. `event_id = negociacao:<id>:contact`.
- **Lead**: `qualidade_contato = 'Bom'` OU `orcamento_enviado = true`. `negociacao:<id>:lead`.
- **Purchase**: `resultado = 'Venda'` E `valor_fechado` preenchido. `negociacao:<id>:purchase`.
  `value = valor_fechado`, `currency = user_profiles.currency` do owner do tenant (fallback BRL).
- Cada estágio uma vez só: `unique(tenant_id, event_id)` + `on conflict do nothing`.
- Fora do escopo: captura no site (fbc/fbp/fbclid só colunas), CTWA no WAHA.

## Arquitetura

Híbrido: **enfileira no Postgres (trigger), envia no TS**.

```
save negociação ─trigger─▶ meta_event_outbox (pending)
                               │
     after() nas rotas ────────┤
     pg_cron 5min → pg_net ────┴─▶ /api/cron/meta-events ─▶ Graph API /{dataset}/events
```

- Trigger cobre todo caminho de escrita (API, webhooks, batch) e é atômico com o save.
- Vercel Hobby: cron Vercel só diário, então pg_cron + pg_net chamam a rota a cada 5 min
  com `CRON_SECRET` (guardado no Vault). No Pro, trocar por cron Vercel.
- Claim via RPC `claim_meta_events` (`for update skip locked`) evita envio duplo.

## Dados

- `negociacoes` + `meta_ad_id`, `meta_sender_id`, `meta_ig_account_id`, `meta_ctwa_clid`,
  `meta_lead_id`, `fbc`, `fbp`, `fbclid` (text null).
- `clientes` + `email` (text null), editável no modal.
- `meta_integrations`: `tenant_id` unique FK restrict, `dataset_id`, `token_secret_id`
  (id no Supabase Vault), `is_active`, `test_event_code`, timestamps. Sem acesso a
  `authenticated`; só service role.
- `meta_event_outbox`: `tenant_id`, `event_name`, `event_id`, `entity_type`, `entity_id`,
  `event_time`, `payload` (sem PII), `status` (pending|processing|sent|failed),
  `attempts`, `next_attempt_at`, `last_error`, `meta_response`, `created_at`, `sent_at`.
  RLS: só service role.
- Outbox grava mesmo sem integração ativa (não perde evento).

## Captura

- Webhook Instagram: `referral.source === 'ADS'` → `meta_ad_id = referral.ad_id`.
  Sempre: `meta_sender_id = sender.id`, `meta_ig_account_id = entry.id`.

## Sender (`src/lib/meta-capi.ts`)

- Monta `user_data` na hora do envio a partir do cliente/negociação:
  - IG: `action_source: business_messaging`, `messaging_channel: instagram`,
    `ig_account_id`, `ig_sid`.
  - Senão: `action_source: system_generated`.
  - Sempre que houver: `ph` (sha256 telefone com DDI), `em` (sha256), `external_id`
    (sha256 cliente_id).
- POST `graph.facebook.com/<versão>/{dataset_id}/events` com `fetch` (sem SDK).
  `test_event_code` quando setado.
- Sucesso → `sent` + `fbtrace_id`. Erro → `attempts++`, backoff `2^n` min (máx 6h),
  `failed` definitivo após 8. Integração inativa → volta a `pending` sem contar tentativa.
- Logs sem token nem PII.
- Pré-requisito Meta: Dataset vinculado à conta IG/Página no Events Manager.

## Tela

`/empresa` aba "Meta Ads" — **só superadmin até homologar**.
- Dataset ID, token (só escrita), `test_event_code`, ativo, "enviar evento de teste".
- Diagnóstico: contagem por status, últimos 20 eventos, "reprocessar falhas".
- API: `GET/PUT /api/empresa/meta`, `POST /api/empresa/meta/testar`, `getCaller()`.

## Testes

- `supabase/tests/meta_outbox.sql`: estágios uma vez só, não-elegível ignorado, Purchase
  espera valor, isolamento por tenant.
- Homologação com `test_event_code` no Events Manager (Prizely primeiro).
