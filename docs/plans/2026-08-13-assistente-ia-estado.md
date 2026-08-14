# Assistente IA — Estado da implementação

Pausado em 13/08/2026. Branch `feat/assistente-ia`, publicada no GitHub.

Documentos irmãos: `2026-08-13-assistente-ia-design.md` (o quê e por quê),
`2026-08-13-assistente-ia-plano.md` (as 17 tasks, com código).

## Onde parou

| Task | Estado | Commit |
|---|---|---|
| 1. Role read-only | ✅ | `0932d4b` |
| 2. Log de auditoria | ✅ | `6368ddd`, `2c267b8` |
| — Fix auto-promoção a admin | ✅ | `3aa1994` |
| 3. Scaffold `agent/` | ✅ | `3af0fdf`, `aeb01bb` |
| 4. Resolução de escopo | ✅ | `e06fbb6` |
| 5. Schema das tools | ✅ | `37053b9` |
| 6. Validação allowlist | ✅ | `79be2dc`, `5487c09` |
| 7. Construção de SQL | ✅ | `6e3cd0a` |
| 8. Executor | ✅ | `f4a080c`, `53fc226` |
| 9. Guard de entrada | ✅ | `bef348c` |
| 10. Loop do LLM | ✅ | `a90b63d` |
| 11. Servidor Fastify | ✅ | `33d57e7` |
| 12. Deploy na VPS | ✅ | `532c174` |
| 13/14. Rota + toggle | ⚠️ **WIP não verificado** | `8efeaea` |
| 15. UI do assistente | ⬜ | — |
| 16. Verificação de segurança | ⬜ | — |
| 17. Merge e liberação | ⬜ | — |

149 testes passando em `agent/`. 66 mutações injetadas e verificadas.

## O que já está em produção e funcionando

`https://agent.prizely.com.br` está no ar, com TLS válido até 11/11/2026.
Verificado de fora:

```
GET  /health                          -> {"ok":true}
POST /chat  sem segredo               -> 401 não autorizado
POST /chat  segredo errado            -> 401 não autorizado
POST /chat  segredo ok + token falso  -> 401 token inválido
http:// -> https://                   -> 301
```

O último caso prova que a VPS alcança o Supabase e valida o token de verdade.

Container: `~/prizely/agent` na VPS (`ssh vps-claude`), Docker Compose,
bind em `172.18.0.1:3030`, publicado pelo Traefik via
`/etc/easypanel/traefik/config/prizely-agent.yaml`.

Atualizar o serviço:
```bash
ssh vps-claude
cd ~/prizely && git pull && cd agent && docker compose up -d --build
```

## ⚠️ O commit `8efeaea` NÃO foi verificado

Contém `src/app/api/assistant/route.ts`, `src/app/api/admin/users/[id]/route.ts`
e alterações em `settings/users/page.tsx` e `admin/users/route.ts`. O código foi
escrito mas **nunca rodou** — a sessão foi interrompida antes da verificação no
navegador. Revisar antes de confiar.

O toggle chegou a ser exercitado (existem perfis com `assistant_enabled: false`
gravado, e a `currency` sobreviveu ao merge no jsonb), mas a rota `/api/assistant`
nunca completou um round trip.

**Nenhuma chamada real ao OpenRouter aconteceu ainda em todo o projeto.**

## Retomando

1. Rodar `pnpm dev`, logar como admin, revisar o WIP em `/settings/users`.
2. Ligar a flag só para você e exercitar `/api/assistant` pelo console:
   ```js
   await (await fetch('/api/assistant', {
     method: 'POST', headers: {'content-type':'application/json'},
     body: JSON.stringify({
       pergunta: 'quantos leads eu tive em 2026?',
       timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
     })
   })).json()
   ```
   Este é o primeiro round trip real ao modelo. Conferir se os números batem
   com o `/dashboard`.
3. Task 15 (UI), depois 16 (bateria de segurança) e 17 (merge).

## Pendências que exigem você

- **Env vars no Vercel** antes do merge: `ASSISTANT_AGENT_URL` e
  `ASSISTANT_SHARED_SECRET`. Os valores estão no `.env.local` e no
  `~/prizely/agent/.env` da VPS. Sem elas a rota devolve 503.
- **Rotacionar a chave do OpenRouter** — ela circulou em texto no chat.
- **Avaliação manual do prompt** contra o DeepSeek real. Três regras só dá para
  validar assim: não abrir com "Claro!", narrar `janela: 'venda'` como venda e
  não como lead, e não somar lista por conta própria em vez de re-consultar.

## Decisões tomadas no caminho que não estão no plano original

- **RLS exige claims por transação.** As policies gateiam em `auth.uid()` e valem
  para o role read-only; sem `set_config('request.jwt.claims', ...)` ele lê zero
  linhas. Para admin o RLS é no-op, então quem garante o escopo é o
  `WHERE user_id = $1` explícito — coberto por teste de integração.
- **Filtro inválido é rejeitado, não descartado.** Descartar produzia resultado
  mais amplo narrado como filtrado.
- **`janela` e `truncado` viajam no resultado.** O modelo precisa saber qual
  coluna de data delimitou o período e se o resultado bateu no teto.
- **Sem streaming SSE.** Conflita com a trava antialucinação: não dá para
  "des-enviar" tokens já emitidos quando a resposta precisa ser refeita.
- **`observacao` fora do `listar_leads`**, `nome` dentro. Prosa livre é bom
  lugar para injection; um push-name de 20 caracteres não é.
- **Trava antialucinação é rasa por construção.** Só pega resposta totalmente
  inventada (zero tools + dígitos). Um modelo que consulta e reporta errado
  passa. A mitigação escolhida foi transparência — o rodapé de proveniência da
  UI mostra os números que a tool devolveu — e não mais regex.
- **`hoje` é calculado no fuso do cliente**, informado pelo navegador e validado
  no servidor. UTC dava o dia errado à noite.
