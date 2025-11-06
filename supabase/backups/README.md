# Backups do Banco Supabase

Este diretório contém backups do banco de dados Supabase para o projeto Prizely.

## Como Fazer Backup

### Opção 1: Usando o Script Automático (Recomendado)

```bash
./supabase/backup-db.sh
```

O script irá:
- Solicitar a connection string do banco (ou usar variáveis de ambiente)
- Criar um backup do schema (estrutura)
- Opcionalmente criar um backup completo (schema + dados)

### Opção 2: Usando o Supabase CLI Diretamente

#### Backup do Schema Apenas

```bash
# Com connection string
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres" --schema-only -f supabase/backups/schema_$(date +%Y%m%d_%H%M%S).sql

# Com projeto linkado
supabase db dump --linked --schema-only -f supabase/backups/schema_$(date +%Y%m%d_%H%M%S).sql
```

#### Backup Completo (Schema + Dados)

```bash
# Com connection string
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres" -f supabase/backups/full_dump_$(date +%Y%m%d_%H%M%S).sql

# Com projeto linkado
supabase db dump --linked -f supabase/backups/full_dump_$(date +%Y%m%d_%H%M%S).sql
```

## Como Obter a Connection String

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** → **Database**
4. Role até a seção **Connection string**
5. Copie a connection string no formato **URI**
6. Substitua `[YOUR-PASSWORD]` pela senha do banco

Formato esperado:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

## Variáveis de Ambiente

Você pode configurar as seguintes variáveis de ambiente para automatizar o processo:

```bash
export SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres"
# OU
export SUPABASE_PROJECT_REF="seu-project-ref"
export SUPABASE_DB_PASSWORD="sua-senha"
```

## Como Restaurar um Backup

### Restaurar Schema Apenas

```bash
# Em um ambiente local com Supabase
supabase db reset
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/backups/schema_YYYYMMDD_HHMMSS.sql

# Ou usando o Supabase CLI
supabase db reset
supabase migration up
# E então aplicar o arquivo SQL
```

### Restaurar Backup Completo

```bash
# Com connection string
psql "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres" -f supabase/backups/full_dump_YYYYMMDD_HHMMSS.sql

# Ou usando o Supabase CLI com db push
supabase db push --db-url "postgresql://..." -f supabase/backups/full_dump_YYYYMMDD_HHMMSS.sql
```

## Estrutura dos Arquivos

- `schema_YYYYMMDD_HHMMSS.sql` - Contém apenas a estrutura do banco (tabelas, views, funções, etc.)
- `full_dump_YYYYMMDD_HHMMSS.sql` - Contém schema + todos os dados

## Importante

⚠️ **Nunca commite arquivos de backup com dados sensíveis no Git!**

Os arquivos de backup são grandes e podem conter dados pessoais. Mantenha-os apenas localmente ou em um serviço de armazenamento seguro.

## Backup Automatizado

Para automatizar backups regulares, você pode criar um cron job:

```bash
# Edite o crontab
crontab -e

# Adicione uma linha para backup diário às 2h da manhã
0 2 * * * cd /Users/charbellelopes/prizely && ./supabase/backup-db.sh >> supabase/backups/backup.log 2>&1
```





