# 🔧 Correção do Problema de Recursão RLS

## 🚨 Problema Identificado
```
infinite recursion detected in policy for relation "users"
```

O erro indica que as políticas RLS (Row Level Security) estão causando recursão infinita, impedindo o acesso às tabelas `users` e `clientes`.

## 🛠️ Solução Rápida (Recomendada)

### 1. Execute o Script de Correção
1. Acesse o **SQL Editor** do Supabase
2. Copie e cole o conteúdo do arquivo `disable-rls-temp.sql`
3. Execute o script

### 2. Verifique se Funcionou
Após executar o script, teste estas consultas no SQL Editor:
```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM clientes;
```

Se retornarem números (não erro), o problema foi resolvido.

## 🔄 Soluções Alternativas

### Opção 1: Políticas Simples (`fix-rls-simple.sql`)
- Mantém RLS habilitado
- Usa políticas básicas sem recursão
- Mais seguro que desabilitar completamente

### Opção 2: Políticas Completas (`fix-rls-policies.sql`)
- Políticas mais específicas e seguras
- Requer configuração adicional de metadados
- Mais complexo de implementar

## 🎯 Próximos Passos

1. **Execute o script de correção**
2. **Teste a aplicação** - acesse `/admin` e `/dashboard`
3. **Verifique se os dados carregam** corretamente
4. **Configure políticas mais seguras** depois (opcional)

## ⚠️ Importante

- A solução temporária desabilita RLS completamente
- Isso significa que qualquer usuário autenticado pode acessar todos os dados
- Para produção, configure políticas mais específicas depois

## 🧪 Teste de Funcionamento

Após aplicar a correção, verifique:

1. **Página principal**: `http://localhost:3000`
2. **Dashboard**: `http://localhost:3000/dashboard`
3. **Admin**: `http://localhost:3000/admin`
4. **Console do navegador**: Não deve haver erros de recursão

## 📁 Arquivos de Correção

- `disable-rls-temp.sql` - **Solução rápida** (recomendada)
- `fix-rls-simple.sql` - Políticas básicas
- `fix-rls-policies.sql` - Políticas completas
- `RLS-FIX-INSTRUCTIONS.md` - Este arquivo
