# Scripts de Migração

Este diretório contém scripts para migração de dados para o Supabase.

## Configuração

Antes de executar os scripts, certifique-se de que o arquivo `.env.local` contém as seguintes variáveis:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# User ID for migration scripts
USER_ID=your_user_id_here
```

## Scripts Disponíveis

### 1. `complete-migration.js`
Migra todos os dados processados para o banco de dados.

**Uso:**
```bash
node scripts/complete-migration.js
```

**Requisitos:**
- Arquivo `docs/processed-leads.json` deve existir
- Usa `SUPABASE_SERVICE_ROLE_KEY` para inserção em lote

### 2. `migrate-csv-data.js`
Processa e migra dados de CSV para o Supabase.

**Uso:**
```bash
node scripts/migrate-csv-data.js
```

**Requisitos:**
- Usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` para operações de leitura/escrita

### 3. `migrate-csv-supabase.js`
Converte dados de CSV para formato compatível com Supabase.

**Uso:**
```bash
node scripts/migrate-csv-supabase.js
```

**Requisitos:**
- Apenas `USER_ID` necessário

## Segurança

⚠️ **Importante:** As chaves de API estão agora protegidas em variáveis de ambiente. Nunca commite o arquivo `.env.local` para o repositório.

## Dependências

Os scripts requerem:
- `@supabase/supabase-js`
- `dotenv`

Instale com:
```bash
pnpm install
```
