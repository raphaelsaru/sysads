# 🧪 Guia Rápido de Teste - Sistema Admin

## ⚡ Configuração Rápida (5 minutos)

### 1️⃣ Execute o SQL no Supabase

```sql
-- Copie e cole todo o conteúdo de admin-setup.sql no SQL Editor do Supabase
```

### 2️⃣ Torne-se Admin

```sql
-- Execute no SQL Editor do Supabase
-- Substitua pelo SEU email
UPDATE users 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

### 3️⃣ Reinicie a Aplicação

```bash
# Faça logout e login novamente
# Ou reinicie o servidor de desenvolvimento
npm run dev
```

## ✅ Checklist de Testes

### Teste 1: Acesso ao Painel Admin
- [ ] Faça login como admin
- [ ] Veja se aparece o link "Admin" no menu do topo
- [ ] Clique em "Admin" (ou acesse `/admin`)
- [ ] Deve ver a lista de todos os usuários cadastrados

**Resultado Esperado:** ✅ Lista de usuários aparece corretamente

### Teste 2: Impersonação
- [ ] No painel admin, escolha um usuário não-admin
- [ ] Clique em "Visualizar como"
- [ ] Deve ser redirecionado para `/dashboard`
- [ ] Banner amarelo aparece no topo dizendo "Modo de Visualização Ativo"
- [ ] Nome da empresa do usuário aparece no título

**Resultado Esperado:** ✅ Vê o dashboard do usuário selecionado

### Teste 3: Navegação Durante Impersonação
- [ ] No dashboard, verifique se as métricas são do usuário impersonado
- [ ] Clique em "Clientes CRM" no menu
- [ ] Deve ver apenas os clientes do usuário impersonado
- [ ] Adicione um filtro ou busca para verificar que está funcionando

**Resultado Esperado:** ✅ Todos os dados são do usuário impersonado

### Teste 4: Sair da Impersonação
- [ ] Clique no botão "Sair da Visualização" no banner amarelo
- [ ] Banner deve desaparecer
- [ ] Deve voltar a ver seus próprios dados
- [ ] Link "Admin" continua visível no menu

**Resultado Esperado:** ✅ Volta ao estado normal de admin

### Teste 5: Segurança - Usuário Normal
- [ ] Faça logout
- [ ] Faça login com um usuário não-admin
- [ ] Link "Admin" NÃO deve aparecer no menu
- [ ] Tente acessar `/admin` diretamente
- [ ] Deve ser bloqueado ou redirecionado

**Resultado Esperado:** ✅ Usuário normal não acessa área admin

## 🐛 Problemas Comuns e Soluções

### ❌ "Não vejo o link Admin no menu"

**Solução:**
```sql
-- Verifique se você é admin
SELECT id, email, role FROM users WHERE email = 'seu-email@exemplo.com';

-- Se role não for 'admin', execute:
UPDATE users SET role = 'admin' WHERE email = 'seu-email@exemplo.com';
```

Depois faça logout e login novamente.

### ❌ "Erro ao visualizar como outro usuário"

**Solução:**
- Verifique se executou o SQL `admin-setup.sql`
- Verifique no console do browser (F12) se há erros
- Verifique se o usuário que está tentando impersonar não é admin

### ❌ "Não vejo todos os usuários no painel admin"

**Solução:**
```sql
-- Verifique as políticas RLS
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('users', 'clientes');

-- Se não houver políticas, execute admin-setup.sql novamente
```

### ❌ "Vejo dados do admin ao invés do usuário impersonado"

**Solução:**
- Limpe o cache do navegador
- Faça hard refresh (Ctrl+Shift+R ou Cmd+Shift+R)
- Verifique no console se `impersonatedUserId` está definido
- Tente clicar em "Sair da Visualização" e impersonar novamente

## 🎯 Teste de Ponta a Ponta

Execute este teste completo para validar tudo:

```
1. ✅ Login como admin
2. ✅ Acessa /admin
3. ✅ Vê lista de usuários
4. ✅ Clica "Visualizar como" no Usuário A
5. ✅ Vê dashboard do Usuário A
6. ✅ Navega para "Clientes CRM"
7. ✅ Vê apenas clientes do Usuário A
8. ✅ Volta para dashboard
9. ✅ Clica "Sair da Visualização"
10. ✅ Volta para /admin
11. ✅ Clica "Visualizar como" no Usuário B
12. ✅ Vê dashboard do Usuário B
13. ✅ Dados são diferentes do Usuário A
14. ✅ Clica "Sair da Visualização"
15. ✅ Faz logout
16. ✅ Login como usuário normal
17. ✅ NÃO vê link "Admin"
18. ✅ Vê apenas seus próprios dados
```

Se todos os passos funcionarem: **🎉 Sistema está 100% funcional!**

## 📝 Checklist de Validação Final

Antes de considerar completo:

- [ ] SQL executado no Supabase
- [ ] Usuário admin criado
- [ ] Painel admin acessível
- [ ] Impersonação funcionando
- [ ] Dados filtrados corretamente
- [ ] Banner de impersonação aparece
- [ ] Sair da visualização funciona
- [ ] Usuários normais bloqueados de admin
- [ ] Navegação entre páginas mantém impersonação
- [ ] Sem erros no console do browser

## 🚀 Pronto para Produção

Se todos os testes passarem, o sistema está pronto!

**Lembre-se:**
- Sempre crie pelo menos 2 usuários para testar impersonação
- Teste com usuários de moedas diferentes (BRL, USD, EUR)
- Adicione alguns clientes para cada usuário para teste completo

---

**Tempo estimado de teste:** 10-15 minutos
**Última atualização:** 30 de Setembro de 2025
