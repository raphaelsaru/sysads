# Instruções para Implementar RLS Admin

## Passo 1: Executar Políticas RLS no Supabase

1. **Acesse o Supabase Dashboard**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

3. **Execute o arquivo SQL**
   - Copie todo o conteúdo do arquivo `admin-rls-policies.sql`
   - Cole no SQL Editor
   - Clique em "Run" para executar

## Passo 2: Verificar se as Políticas Foram Criadas

Após executar o SQL, você deve ver uma tabela com todas as políticas criadas. Se aparecerem erros, verifique:

- Se as tabelas `users` e `clientes` existem
- Se o usuário atual tem permissões de administrador no banco
- Se RLS já estava habilitado nas tabelas

## Passo 3: Testar a Aplicação

1. **Reinicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

2. **Acesse a aplicação**
   - Vá para http://localhost:3000
   - Faça login com sua conta admin
   - Você deve ser redirecionado automaticamente para `/admin`

3. **Verifique o console administrativo**
   - Deve mostrar todos os usuários do sistema
   - Deve permitir visualizar dados de cada usuário
   - Deve permitir impersonation (visualizar como outro usuário)

## Como as Políticas Funcionam

### Para Usuários Normais:
- Podem ver apenas seus próprios dados
- Podem criar/editar/deletar apenas seus próprios clientes
- Não podem ver dados de outros usuários

### Para Administradores:
- Podem ver todos os usuários do sistema
- Podem ver todos os clientes de todos os usuários
- Podem criar/editar/deletar dados de qualquer usuário
- Podem fazer impersonation (visualizar como outro usuário)

## Solução de Problemas

### Se ainda aparecer "Não autorizado":
1. Verifique se o usuário tem `role = 'admin'` na tabela `users`
2. Verifique se as políticas foram criadas corretamente
3. Verifique os logs do servidor para mais detalhes

### Se não aparecerem todos os usuários:
1. Verifique se existem outros usuários na tabela `users`
2. Verifique se as políticas de SELECT foram criadas
3. Verifique se RLS está habilitado nas tabelas

### Para verificar usuários no banco:
```sql
SELECT id, email, role, company_name FROM users ORDER BY created_at;
```

### Para verificar políticas criadas:
```sql
SELECT tablename, policyname, cmd FROM pg_policies 
WHERE tablename IN ('users', 'clientes')
ORDER BY tablename, policyname;
```

