# Design: Sincronização com Google Calendar

## Contexto
Admin quer ver, dentro do Prizely, a agenda do Google Calendar de cada tatuador (usuário do Prizely) que compartilhar sua agenda com a conta Google do admin. Caso concreto: Charbelle Lopes já compartilhou sua agenda.

## Fluxo geral
- Admin conecta **sua própria conta Google** uma única vez (OAuth, escopo `calendar.readonly`).
- Admin mapeia, em `/admin/google-calendar`, cada tatuador para uma agenda (`calendarId`) visível pela sua conta.
- Nova página `/calendario`: qualquer usuário logado vê a agenda mapeada pra ele; admin tem um seletor pra ver a de qualquer tatuador mapeado.
- Sem cross-reference com a tabela `clientes` — é visualização pura dos eventos do Google.
- Sem persistência/cache de eventos — busca sempre ao vivo na Calendar API.

## Modelo de dados (novas tabelas)

### `google_calendar_connections`
Linha única (conta do admin).
- `id` uuid pk
- `access_token` text
- `refresh_token` text
- `expiry_date` timestamptz
- `connected_email` text
- `created_at`, `updated_at` timestamptz

### `google_calendar_mappings`
- `user_id` uuid FK `user_profiles.id`, unique
- `calendar_id` text (ID da agenda no Google)
- `calendar_name` text (nome amigável pra exibir)
- `created_at` timestamptz

## Rotas API (`src/app/api/google-calendar/`)
- `GET /auth` — redireciona pro consent OAuth do Google.
- `GET /callback` — troca code por tokens, grava em `google_calendar_connections` (via `supabase-admin`).
- `GET /calendars` — lista agendas visíveis pra conta conectada (`calendarList.list`), admin-only, usado no mapeamento.
- `POST /mappings` — salva/atualiza `google_calendar_mappings` (admin-only).
- `GET /events?userId=&month=YYYY-MM` — retorna eventos normalizados do mês pro `calendarId` mapeado ao `userId`. Não-admin é forçado a `userId = session.user.id`. Refresca token automaticamente se expirado.
- `GET /events/range?userId=&startMonth=YYYY-MM&months=8` — busca eventos de uma janela ampla (ex: 8 meses) numa única chamada à Calendar API e agrupa contagem por mês no servidor — usado pelo resumo.

## Páginas

### `/admin/google-calendar` (admin-only)
- Status da conexão (email conectado / botão reconectar).
- Tabela: cada tatuador + dropdown de agendas disponíveis + botão salvar.

### `/calendario` (qualquer usuário logado)
- Seletor de tatuador (só admin vê).
- Grid mensal (prev/next) com contagem de eventos por dia.
- Clicar num dia abre modal (`Dialog`) com lista dos eventos daquele dia (horário, título, descrição).
- Abaixo: cards de resumo do mês atual (total, dia mais cheio) + tabela de janela rolante de 8 meses (mês | total de eventos), com prev/next pra deslocar a janela — cobre hoje "ago/2026 → mar/2027" sem hardcode de datas.

## Componentes novos (`src/components/calendario/`)
- `CalendarioMensal.tsx`
- `DiaEventosDialog.tsx`
- `ResumoMensal.tsx`
- `TatuadorSelector.tsx`

## Hook
- `useGoogleCalendarEvents(userId, month)` em `src/hooks/`, padrão dos hooks existentes (loading/error/data).

## Erros
- Token inválido/revogado → 401 específico da API; banner na página ("conexão expirou"), botão reconectar só pro admin.
- Tatuador sem mapping → estado vazio, sem chamar API.
- Falha/rate-limit da Calendar API → erro no hook, botão retry.

## Teste manual (não há suíte automatizada pra isso)
1. Conectar conta Google real em `/admin/google-calendar`.
2. Mapear agenda da Charbelle pro user dela.
3. Ver `/calendario` como Charbelle (ou via impersonate): grid do mês, clicar dia com evento, ver lista.
4. Como admin, trocar seletor de tatuador.
5. Navegar janela de 8 meses no resumo e conferir contagens contra o Google Calendar real.
