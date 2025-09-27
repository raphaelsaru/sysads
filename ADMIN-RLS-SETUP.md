# Configuração RLS para Administradores - Prizely

## 📋 Resumo

Este guia configura políticas RLS (Row Level Security) no Supabase para permitir que usuários com role `admin` tenham acesso completo a todos os dados do sistema.

## 🚀 Execução

### 1. Executar Script SQL
1. Acesse o **Supabase Dashboard** do projeto Prizely
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo do arquivo `admin-rls-complete.sql`
4. Execute o script clicando em **Run**

### 2. Verificar Execução
O script vai exibir mensagens de confirmação no final:
```
✅ Políticas RLS configuradas com sucesso!
📊 Tabelas com RLS habilitado:
  - users: true
  - clientes: true
🔧 Funções RPC criadas:
  - auth.is_admin()
  - get_all_users_admin()
  - get_user_clientes_admin(uuid)
```

## 🔧 O que foi Configurado

### Políticas para Tabela `users`
- **SELECT**: Usuários veem próprio perfil, admins veem todos
- **INSERT**: Admins podem criar usuários, usuários podem criar próprio perfil
- **UPDATE**: Usuários editam próprio perfil, admins editam qualquer um
- **DELETE**: Apenas admins podem deletar usuários

### Políticas para Tabela `clientes`
- **SELECT**: Usuários veem próprios clientes, admins veem todos
- **INSERT**: Usuários criam clientes para si, admins para qualquer usuário
- **UPDATE**: Usuários editam próprios clientes, admins editam qualquer um
- **DELETE**: Usuários deletam próprios clientes, admins deletam qualquer um

### Funções RPC Criadas

#### `public.is_admin()`
Função auxiliar que verifica se o usuário atual tem role 'admin'. Evita recursão nas políticas RLS.

#### `get_all_users_admin()`
Retorna todos os usuários do sistema com estatísticas:
- Total de clientes
- Total de vendas
- Valor total vendido

**Uso na aplicação:**
```javascript
const { data, error } = await supabase.rpc('get_all_users_admin')
```

#### `get_user_clientes_admin(target_user_id)`
Retorna todos os clientes de um usuário específico.

**Uso na aplicação:**
```javascript
const { data, error } = await supabase.rpc('get_user_clientes_admin', {
  target_user_id: 'uuid-do-usuario'
})
```

## 🔐 Segurança

- **Validação**: Todas as funções verificam se o usuário é admin antes de executar
- **Isolamento**: Usuários normais continuam vendo apenas seus próprios dados
- **Auditoria**: As políticas são transparentes e auditáveis
- **Fallback**: Em caso de erro, a política nega acesso por padrão

## 🧪 Testando

### 1. Criar Usuário Admin
```sql
-- Execute no SQL Editor para criar um admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

### 2. Testar Acesso Admin
```javascript
// Na aplicação, teste se o admin pode ver todos os usuários
const { data: allUsers } = await supabase.rpc('get_all_users_admin')
console.log('Total de usuários visíveis:', allUsers?.length)
```

### 3. Testar Acesso Normal
```javascript
// Faça login com usuário normal e teste
const { data: users } = await supabase.from('users').select('*')
// Deve retornar apenas o próprio usuário
```

## 🚨 Troubleshooting

### Erro "function auth.is_admin() does not exist"
- Execute novamente o script SQL completo
- Verifique se não há erros na criação da função

### Admin não consegue ver outros usuários
1. Verifique se o role está definido como 'admin':
```sql
SELECT id, email, role FROM users WHERE email = 'seu-email@exemplo.com';
```

2. Teste a função admin:
```sql
SELECT public.is_admin();
-- Deve retornar 'true' se você for admin
```

### Políticas não estão funcionando
```sql
-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('users', 'clientes');
```

## 📱 Próximos Passos

Após executar este script:
1. ✅ As APIs de admin funcionarão corretamente
2. ✅ A página `/admin` mostrará todos os usuários
3. ✅ Admins poderão impersonar outros usuários
4. ✅ Funcionalidade de visualização completa estará disponível

A aplicação React já está preparada para usar essas permissões!
