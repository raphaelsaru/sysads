# Guia de Backup do Banco Supabase - Prizely

Este guia explica como fazer backup completo da estrutura do banco Supabase para o projeto Prizely.

## 📋 O que foi Configurado

1. **Script de Backup Automático** (`backup-db.sh`)
   - Cria backups do schema (estrutura)
   - Opcionalmente cria backups completos (schema + dados)
   - Suporta múltiplos métodos de conexão

2. **Script de Pull de Schema** (`pull-schema.sh`)
   - Puxa o schema atual do banco remoto
   - Cria migrations automaticamente
   - Útil para sincronizar estrutura local com remota

3. **Diretório de Backups** (`backups/`)
   - Local onde os backups são salvos
   - README com instruções detalhadas

## 🚀 Como Fazer Backup

### Método 1: Script Automático (Recomendado)

```bash
./supabase/backup-db.sh
```

O script irá:
1. Solicitar o tipo de backup (schema, completo, ou ambos)
2. Pedir a connection string ou usar variáveis de ambiente
3. Criar arquivos de backup com timestamp

### Método 2: Comando Direto do Supabase CLI

#### Backup do Schema Apenas

```bash
supabase db dump \
  --db-url "postgresql://postgres:[SENHA]@[PROJECT_REF].supabase.co:5432/postgres" \
  --schema-only \
  -f supabase/backups/schema_$(date +%Y%m%d_%H%M%S).sql
```

#### Backup Completo

```bash
supabase db dump \
  --db-url "postgresql://postgres:[SENHA]@[PROJECT_REF].supabase.co:5432/postgres" \
  -f supabase/backups/full_dump_$(date +%Y%m%d_%H%M%S).sql
```

## 🔑 Como Obter a Connection String

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto Prizely
3. Vá em **Settings** → **Database**
4. Na seção **Connection string**, copie a string no formato **URI**
5. Substitua `[YOUR-PASSWORD]` pela senha do banco

**Formato esperado:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

## 🔄 Usando Variáveis de Ambiente

Para automatizar, você pode configurar no seu `.env.local`:

```bash
# Connection string completa
export SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres"

# OU separado
export SUPABASE_PROJECT_REF="seu-project-ref"
export SUPABASE_DB_PASSWORD="sua-senha"
```

## 📥 Restaurar um Backup

### Restaurar Schema

```bash
# Se tiver um ambiente local Supabase rodando
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/backups/schema_YYYYMMDD_HHMMSS.sql

# Ou diretamente no banco remoto
psql "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres" \
  -f supabase/backups/schema_YYYYMMDD_HHMMSS.sql
```

### Restaurar Backup Completo

```bash
psql "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres" \
  -f supabase/backups/full_dump_YYYYMMDD_HHMMSS.sql
```

## 📁 Estrutura dos Backups

Os arquivos de backup são salvos em `supabase/backups/` com o seguinte formato:

- **`schema_YYYYMMDD_HHMMSS.sql`** - Apenas estrutura (tabelas, views, funções, políticas RLS, etc.)
- **`full_dump_YYYYMMDD_HHMMSS.sql`** - Schema completo + todos os dados

## ⚠️ Importante

1. **Nunca commite arquivos de backup no Git** - Eles podem conter dados sensíveis
2. **Mantenha backups em local seguro** - Considere usar um serviço de armazenamento
3. **Faça backups regularmente** - Especialmente antes de mudanças importantes
4. **Teste a restauração** - Periodicamente, teste se os backups podem ser restaurados

## 🔄 Sincronizar Schema (Método Alternativo)

Se você quiser criar migrations baseadas no estado atual do banco:

```bash
./supabase/pull-schema.sh
```

Isso irá:
- Conectar ao banco remoto
- Criar migrations baseadas no schema atual
- Salvar em `supabase/migrations/`

## 🛠️ Resolução de Problemas

### Erro: "Your account does not have the necessary privileges"

Isso significa que você precisa:
1. Fazer login no Supabase CLI: `supabase login`
2. Ou usar a connection string diretamente com `--db-url`

### Erro: "pg_dump not found"

O Supabase CLI usa `pg_dump` internamente. Se você tiver problemas, pode instalar:
```bash
# macOS
brew install postgresql

# Ou use o método alternativo com connection string
```

## 📚 Referências

- [Documentação Supabase CLI](https://supabase.com/docs/reference/cli)
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- Veja também: `supabase/backups/README.md` para mais detalhes


