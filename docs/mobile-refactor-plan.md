# Plano de Refatoração Prizely – App Mobile (Expo)

## 1. Objetivo do trabalho
- Entregar uma versão mobile (React Native + Expo) com a mesma experiência do usuário final já disponível no web app, excluindo funcionalidades de admin.
- Garantir que o aplicativo compartilhe a mesma base Supabase e respeite as políticas de RLS estabelecidas (`users`, `clientes`).
- Estruturar o monorepo/projeto para compartilhar domínio, serviços e validações entre web e mobile, reduzindo duplicação e riscos de regressão.

## 2. Estado atual (snapshot)

### 2.1 Frontend web (Next.js 15)
- Páginas principais: CRM (`src/app/page.tsx`), Dashboard (`src/app/dashboard/page.tsx`), fluxo de login (`src/app/auth`).
- Contextos críticos:
  - `AuthContext` com sessão persistida em `localStorage` e fallback de conexão (`src/contexts/AuthContext.tsx`).
  - Hooks de domínio: `useClientes` para CRUD/estatísticas, `useDailyQuote`, `useConnectionHealth`.
- Componentes de domínio: formulários e tabelas de clientes (`src/components/ClienteForm.tsx`, `src/components/ClienteTable.tsx`, `src/components/ClienteModal.tsx`).

### 2.2 Integração com Supabase
- Cliente singleton web orientado a browser (`src/lib/supabase.ts`), server client para API routes (`src/lib/supabase-server.ts`).
- Acesso direto ao Supabase em hooks client-side (`src/hooks/useClientes.ts`, `src/app/dashboard/page.tsx`).
- API REST opcional para clientes (`src/app/api/clientes`) usada por automações/server components.

### 2.3 Garantias de segurança/dados
- RLS simplificada para `users` e `clientes`, garantindo filtragem por `auth.uid()` (ver `fix-rls-simple-final.sql`).
- Funções PL/pgSQL dão suporte a casos de admin, mas não serão expostas no app mobile.

## 3. Diretrizes arquiteturais para o mobile

1. **Monorepo com camadas compartilhadas**  
   - Criar estrutura `apps/web` (já existente) e `apps/mobile` (Expo).  
   - Extrair lógica comum para `packages/core` (tipos, utilitários, formatação), `packages/supabase` (cliente isomórfico), `packages/domain-crm` (serviços + hooks/agregadores sem dependência de UI).

2. **Cliente Supabase isomórfico**  
   - Encapsular criação de client em módulo compartilhado com injeção de storage (browser usa `localStorage`, mobile usa `@react-native-async-storage/async-storage` ou `expo-secure-store`) e configuração de `fetch` baseada em `cross-fetch`.

3. **Autenticação multiplataforma**  
   - Reescrever AuthContext para separar lógica de negócio (supabase auth + perfil) de efeitos específicos de UI; expor serviços reutilizáveis.  
   - Evitar `window.location.reload` e manipulação direta do DOM; no mobile, usar React Navigation para controle de fluxo.

4. **Acesso aos dados do CRM**  
   - Padronizar serviços (ex.: `clientesService`) com métodos `list`, `create`, `update`, `remove`, `stats`.  
   - Permitir modo direto (Supabase JS) e modo REST (chamando `/api`) para fallback/offline-first futuro.

5. **Sincronização/offline** (posterior, mas preparada)  
   - Arquitetar camada de dados com React Query/TanStack Query ou Zustand persistível para facilitar cache e sincronização offline no mobile.

6. **UI / Design system**  
   - Adotar biblioteca mobile (ex.: Expo Router + NativeWind ou Tamagui) alinhada ao visual atual, mantendo tokens de cor/tipografia.  
   - Mapear componentes equivalentes ao que existe em `src/components/ui`.

## 4. Roadmap em fases

### Fase 0 – Preparação (Infra e alinhamentos)
1. Atualizar repo para monorepo (Turborepo ou Nx) ou configurar workspace PNPM com `apps/` e `packages/`.
2. Documentar variáveis de ambiente compartilhadas (.env.*) e pipeline de build (web + mobile).
3. Definir stack do mobile (Expo SDK atual, React Native 0.76, React Navigation 7, TanStack Query, Zustand, NativeWind/Tamagui).

### Fase 1 – Extração de domínio compartilhado
1. Mover `src/types/crm.ts` para `packages/core/src/types/crm.ts`.
2. Reorganizar utilitários (`currency`, `dateUtils`, validações) em `packages/core`.
3. Criar `packages/supabase`:
   - Função `createSupabaseClient({ storageAdapter, fetchImplementation, timeout })`.
   - Exportar hooks/helpers para autenticação básica (getUser, signIn, etc.).
4. Adaptar web app para usar os novos pacotes (garantir zero regressões).

### Fase 2 – Serviços de negócio
1. Extrair lógicas de `useClientes` para `packages/domain-crm`:
   - Serviço `clientesService` (CRUD + stats).
   - Hooks sem dependência de UI (e.g. `useClientesQuery`) usando TanStack Query (web e mobile compartilham).
2. Refatorar Dashboard para consumir serviços compartilhados.
3. Converter API routes para reutilizar a mesma camada de domínio (evitar divergência de mapeamentos).

### Fase 3 – App mobile (Expo)
1. Inicializar `apps/mobile` com Expo Router (TypeScript).
2. Integrar `packages/core`, `packages/supabase`, `packages/domain-crm`.
3. Implementar auth flow mobile:
   - Telas de login/cadastro, fluxo pós-confirmação.
   - Persistência de sessão com `AsyncStorage`.
4. Implementar telas:
   - Lista de clientes (com filtros essenciais e paginação infinita).
   - Formulário modal/pilha para criar/editar cliente.
   - Dashboard móvel (cards + gráfico simplificado, considerar Victory Native/Recharts wrapper).
5. Navegação:
   - Stack principal protegida por contexto de auth.
   - Tabs ou Drawer para “Clientes” e “Dashboard”.

### Fase 4 – Qualidade, testes e observabilidade
1. Tests:
   - Unitários para serviços (Jest) no pacote compartilhado.
   - Component tests com React Native Testing Library.
   - E2E mobile (Detox/Expo E2E) em backlog.
2. Automatizar linters/formatters cross-platform.
3. Configurar Sentry/Expo Updates para monitoramento.

### Fase 5 – Release e operações
1. Configurar perfis de build (Expo EAS) para Android/iOS.
2. Preparar guias de publicação (Google Play Internal, TestFlight).
3. Definir estratégia de versionamento alinhada ao web (Changelog unificado).
4. Planejar feature flags para futuras funções exclusivas de mobile (notificações push, offline, etc.).

## 5. Considerações adicionais

- **Fluxo de perfil**: Atual `fetchUserProfile` usa `setTimeout` e localStorage (`src/contexts/AuthContext.tsx`). No mobile converter para efeitos assíncronos padrão, talvez com Recoil/Zustand.
- **Cotação diária (`useDailyQuote`)**: depende de `localStorage` (`src/hooks/useDailyQuote.ts`); migrar para `AsyncStorage` e criar wrapper de cache isomórfico.
- **Dashboard**: manipula números/estatísticas diretamente; consolidar cálculos no domínio para garantir consistência.
- **RLS**: validar que chamadas mobile sempre incluem `supabase.auth` (não expor `service_role`). Manter SQL de políticas atualizado (`fix-rls-simple-final.sql`).
- **Admin**: manter segregado; garantir que mobile não tenha rotas ou permissões administrativas.

## 6. Riscos & mitigação
- **Dependência de browser APIs** → extrair/adaptar antes de iniciar mobile.
- **Diferenças de UI/UX** → prototipar em Figma, alinhar com stakeholders.
- **Tempo de build/monorepo** → validar estratégia (Turborepo vs workspaces simples) e pipelines.
- **Gerenciamento de sessão** → testar thoroughly reconexões/token refresh em mobile.

## 7. Próximos passos imediatos
1. Validar com o time a estrutura de monorepo proposta e bibliotecas mobile preferenciais.
2. Criar branch `feat/mobile-architecture` contendo setup dos pacotes compartilhados.
3. Ajustar web app para consumir `packages/core` e `packages/domain-crm` (garantir testes).
4. Iniciar scaffolding Expo após camada compartilhada estabilizada.
