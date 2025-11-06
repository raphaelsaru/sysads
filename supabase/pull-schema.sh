#!/bin/bash

# Script para puxar o schema atual do banco remoto e criar migrations
# Este é um método alternativo que cria migrations baseadas no estado atual do banco

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Puxando schema do banco Supabase...${NC}"

# Verifica se temos project-ref configurado
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${YELLOW}⚠️  Variável SUPABASE_PROJECT_REF não encontrada.${NC}"
    echo -e "${YELLOW}Para obter o project-ref:${NC}"
    echo -e "  Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT_REF]"
    echo -e "  O project-ref está na URL: https://supabase.com/dashboard/project/[PROJECT_REF]"
    echo ""
    read -p "Digite o project-ref do seu projeto: " PROJECT_REF
    
    if [ ! -z "$PROJECT_REF" ]; then
        export SUPABASE_PROJECT_REF="$PROJECT_REF"
    else
        echo -e "${RED}❌ Project-ref é obrigatório${NC}"
        exit 1
    fi
fi

# Verifica se precisa de senha
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo -e "${YELLOW}Digite a senha do banco de dados:${NC}"
    read -s PASSWORD
    export SUPABASE_DB_PASSWORD="$PASSWORD"
fi

# Tenta fazer pull do schema
echo -e "${GREEN}📥 Fazendo pull do schema remoto...${NC}"

# Cria migrations baseadas no estado atual do banco
supabase db pull --linked 2>&1 || {
    echo -e "${YELLOW}⚠️  Tentando com project-ref diretamente...${NC}"
    
    # Alternativa: usar link primeiro
    supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" 2>&1 || {
        echo -e "${RED}❌ Não foi possível fazer link com o projeto${NC}"
        echo -e "${YELLOW}Você pode precisar fazer login primeiro: supabase login${NC}"
        exit 1
    }
    
    # Agora tenta o pull
    supabase db pull --linked 2>&1 || {
        echo -e "${RED}❌ Erro ao fazer pull do schema${NC}"
        exit 1
    }
}

echo -e "${GREEN}✅ Schema puxado com sucesso!${NC}"
echo -e "${GREEN}As migrations foram criadas em: supabase/migrations/${NC}"

# Lista as migrations criadas
if [ -d "supabase/migrations" ]; then
    echo -e "${GREEN}Migrations disponíveis:${NC}"
    ls -lh supabase/migrations/ | tail -n +2 || true
fi





