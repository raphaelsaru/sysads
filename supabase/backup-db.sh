#!/bin/bash

# Script de Backup do Banco Supabase
# Este script cria um backup completo da estrutura e dados do banco Supabase

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Diretório de backups
BACKUP_DIR="supabase/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SCHEMA_FILE="$BACKUP_DIR/schema_$TIMESTAMP.sql"
DATA_FILE="$BACKUP_DIR/data_$TIMESTAMP.sql"
FULL_DUMP_FILE="$BACKUP_DIR/full_dump_$TIMESTAMP.sql"

echo -e "${GREEN}🔄 Iniciando backup do banco Supabase...${NC}"

# Verifica se a pasta de backups existe
mkdir -p "$BACKUP_DIR"

# Verifica se temos connection string ou project-ref
if [ -z "$SUPABASE_DB_URL" ] && [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${YELLOW}⚠️  Variáveis de ambiente não encontradas.${NC}"
    echo -e "${YELLOW}Você pode fornecer:${NC}"
    echo -e "  1. SUPABASE_DB_URL (connection string completa)"
    echo -e "  2. SUPABASE_PROJECT_REF (ID do projeto) + SUPABASE_DB_PASSWORD"
    echo ""
    echo -e "${YELLOW}Para obter a connection string:${NC}"
    echo -e "  Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT_REF]/settings/database"
    echo -e "  Copie a 'Connection string' (URI format)"
    echo ""
    read -p "Digite a connection string do banco (ou pressione Enter para tentar com link): " DB_URL
    
    if [ ! -z "$DB_URL" ]; then
        export SUPABASE_DB_URL="$DB_URL"
    fi
fi

# Função para fazer dump do schema
dump_schema() {
    echo -e "${GREEN}📋 Fazendo dump do schema...${NC}"
    
    if [ ! -z "$SUPABASE_DB_URL" ]; then
        supabase db dump --db-url "$SUPABASE_DB_URL" --schema-only -f "$SCHEMA_FILE" 2>&1 || {
            echo -e "${RED}❌ Erro ao fazer dump do schema com --db-url${NC}"
            return 1
        }
    elif [ ! -z "$SUPABASE_PROJECT_REF" ]; then
        supabase db dump --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" --schema-only -f "$SCHEMA_FILE" 2>&1 || {
            echo -e "${RED}❌ Erro ao fazer dump do schema com project-ref${NC}"
            return 1
        }
    else
        # Tenta usar o projeto linkado
        supabase db dump --linked --schema-only -f "$SCHEMA_FILE" 2>&1 || {
            echo -e "${YELLOW}⚠️  Não foi possível fazer dump com projeto linkado.${NC}"
            echo -e "${YELLOW}Tente fornecer SUPABASE_DB_URL ou configurar o link primeiro.${NC}"
            return 1
        }
    fi
    
    echo -e "${GREEN}✅ Schema salvo em: $SCHEMA_FILE${NC}"
}

# Função para fazer dump completo (schema + dados)
dump_full() {
    echo -e "${GREEN}💾 Fazendo dump completo (schema + dados)...${NC}"
    
    if [ ! -z "$SUPABASE_DB_URL" ]; then
        supabase db dump --db-url "$SUPABASE_DB_URL" -f "$FULL_DUMP_FILE" 2>&1 || {
            echo -e "${RED}❌ Erro ao fazer dump completo com --db-url${NC}"
            return 1
        }
    elif [ ! -z "$SUPABASE_PROJECT_REF" ]; then
        supabase db dump --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" -f "$FULL_DUMP_FILE" 2>&1 || {
            echo -e "${RED}❌ Erro ao fazer dump completo com project-ref${NC}"
            return 1
        }
    else
        # Tenta usar o projeto linkado
        supabase db dump --linked -f "$FULL_DUMP_FILE" 2>&1 || {
            echo -e "${YELLOW}⚠️  Não foi possível fazer dump com projeto linkado.${NC}"
            echo -e "${YELLOW}Tente fornecer SUPABASE_DB_URL ou configurar o link primeiro.${NC}"
            return 1
        }
    fi
    
    echo -e "${GREEN}✅ Dump completo salvo em: $FULL_DUMP_FILE${NC}"
}

# Menu de opções
echo ""
echo -e "${GREEN}Escolha o tipo de backup:${NC}"
echo "  1) Schema apenas (estrutura do banco)"
echo "  2) Dump completo (schema + dados)"
echo "  3) Ambos"
read -p "Digite sua escolha (1-3): " choice

case $choice in
    1)
        dump_schema
        ;;
    2)
        dump_full
        ;;
    3)
        dump_schema
        dump_full
        ;;
    *)
        echo -e "${RED}Opção inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Backup concluído!${NC}"
echo -e "${GREEN}Arquivos salvos em: $BACKUP_DIR${NC}"

# Lista os arquivos criados
ls -lh "$BACKUP_DIR"/*"$TIMESTAMP"* 2>/dev/null || true


