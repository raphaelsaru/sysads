# prizely-agent

Serviço do assistente IA do Prizely. Roda na VPS, **não** no Vercel.

Responde perguntas sobre os dados do CRM lendo o Supabase por tools
estruturadas. Somente leitura, escopo travado por usuário.

## Como funciona

```
Browser -> /api/assistant (Next, Vercel)
             Authorization: Bearer <access_token do usuario>
             X-Prizely-Secret: <segredo compartilhado>
        -> POST /chat (este servico, VPS)
             1. confere o segredo
             2. valida o token no Supabase
             3. resolve scopeUserId  <- antes do LLM entrar em cena
             4. guard de entrada
             5. loop de tool calling no OpenRouter
             6. grava auditoria
```

O `scopeUserId` é resolvido uma vez e nunca mais é tocado. Nenhuma tool
aceita `user_id` como parâmetro — o executor injeta o escopo no `WHERE`.

## Duas camadas de escopo

1. **`WHERE user_id = $1`** explícito em todo SQL. É a defesa principal.
2. **RLS** via `set_config('request.jwt.claims', ...)` por transação.
   Sem isso o role read-only lê zero linhas, porque as policies existentes
   gateiam em `auth.uid()`.

Para admin o RLS é no-op (`is_admin()` libera tudo), então a camada 1 é
quem garante que admin sem impersonar vê só os próprios dados.

## Rodando local

```bash
cp .env.example .env   # preencha os valores
npm install
npm run dev            # http://localhost:3030
npm test
```

Os testes de integração pulam sozinhos se `DATABASE_URL` não estiver setada.

## Deploy

```bash
ssh vps-claude
cd ~/prizely && git pull
cd agent && docker compose up -d --build
```

Publicado pelo Traefik em `agent.prizely.com.br`
(`/etc/easypanel/traefik/config/prizely-agent.yaml`).

## Nota sobre a senha do role

A migration `20260813120000_assistant_readonly_role.sql` cria
`prizely_agent_ro` com a senha placeholder `trocar-depois`. Num ambiente
novo, rode `ALTER ROLE prizely_agent_ro PASSWORD '<forte>'` depois de
aplicar as migrations, e use essa senha na `DATABASE_URL`.
