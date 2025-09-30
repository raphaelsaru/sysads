# 🔐 Sistema de Administração - Prizely

Sistema simples e funcional para administradores visualizarem e gerenciarem usuários.

## ✨ Funcionalidades

### Para Administradores:
- ✅ Ver todos os usuários do sistema
- ✅ Visualizar o sistema como qualquer usuário (impersonação)
- ✅ Ver clientes, dashboard e todas as funcionalidades de qualquer usuário
- ✅ Interface intuitiva e moderna

### Para Usuários Normais:
- ✅ Ver apenas seus próprios dados
- ✅ Não tem acesso ao painel admin
- ✅ Sistema funciona normalmente

## 🚀 Como Configurar

### Passo 1: Executar SQL no Supabase

1. Acesse o **Supabase Dashboard** (https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **New query**
5. Copie todo o conteúdo do arquivo `admin-setup.sql`
6. Cole no editor e clique em **Run**
7. Aguarde a confirmação de sucesso

### Passo 2: Criar um Usuário Admin

Após executar o SQL, você precisa tornar seu usuário um administrador:

```sql
-- Execute no SQL Editor do Supabase
UPDATE users 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

**⚠️ IMPORTANTE:** Substitua `'seu-email@exemplo.com'` pelo email que você usa para fazer login no sistema.

### Passo 3: Testar o Sistema

1. Faça logout e login novamente
2. Você deve ver um link "Admin" no menu (ou acesse `/admin` diretamente)
3. Você verá a lista de todos os usuários
4. Clique em "Visualizar como" para ver o sistema como outro usuário

## 📖 Como Usar

### Acessando o Painel Admin

1. Faça login como administrador
2. Acesse `/admin` ou clique no link "Admin" no menu
3. Você verá a lista de todos os usuários cadastrados

### Impersonando um Usuário

1. No painel admin, clique em **"Visualizar como"** no usuário desejado
2. Você será redirecionado para o dashboard
3. Verá todos os dados daquele usuário (clientes, dashboard, etc.)
4. Um banner amarelo aparecerá no topo indicando que você está em modo de visualização
5. Clique em **"Sair da Visualização"** para voltar ao modo admin

### Navegando Durante Impersonação

Quando estiver visualizando como outro usuário:
- O **Dashboard** mostrará os dados daquele usuário
- A **página de Clientes** mostrará os clientes daquele usuário
- Você verá tudo exatamente como o usuário vê
- O nome da empresa do usuário aparecerá no topo das páginas

## 🔒 Segurança

### Proteções Implementadas:

1. **Row Level Security (RLS):** Políticas no Supabase garantem que:
   - Usuários normais só veem seus próprios dados
   - Admins conseguem ver todos os dados
   
2. **Validação na API:** Todas as APIs verificam se o usuário é admin

3. **Validação no Frontend:** Páginas admin verificam a role do usuário

4. **Impersonação Apenas de Não-Admins:** Admins não podem impersonar outros admins

## 🛠️ Arquivos Criados

### Backend:
- `/src/contexts/AdminContext.tsx` - Contexto de administração e impersonação
- `/src/app/api/admin/users/route.ts` - API para listar usuários
- `/src/hooks/useClientes.ts` - Modificado para aceitar userId opcional

### Frontend:
- `/src/app/admin/page.tsx` - Página de administração
- `/src/app/dashboard/page.tsx` - Modificado para usar impersonação
- `/src/app/page.tsx` - Modificado para usar impersonação

### SQL:
- `/admin-setup.sql` - Script de configuração das políticas RLS

## ❓ Solução de Problemas

### Não consigo acessar /admin

**Verifique:**
1. Se você executou o SQL no Supabase
2. Se você tornou seu usuário admin com o UPDATE
3. Se fez logout e login novamente
4. Se o email no UPDATE está correto

### Não vejo todos os usuários

**Verifique:**
1. Se as políticas RLS foram criadas corretamente
2. Se seu usuário tem `role = 'admin'` na tabela users
3. No console do browser, veja se há erros de API

### Erro ao visualizar como outro usuário

**Verifique:**
1. Se as políticas RLS foram aplicadas corretamente
2. Se você está tentando impersonar um usuário que não é admin
3. No console do browser, veja os logs de erro

## 📝 Notas Importantes

- ⚠️ **Apenas um usuário admin por vez:** Não tente impersonar outro admin
- ⚠️ **Sempre execute o SQL no Supabase:** As políticas RLS são essenciais para o funcionamento
- ⚠️ **Faça logout/login após tornar-se admin:** Necessário para atualizar a sessão
- ✅ **Sistema funciona sem RPC:** Não depende de funções customizadas, usa apenas políticas RLS

## 🎯 Fluxo de Uso

```
1. Admin acessa /admin
2. Vê lista de todos os usuários
3. Clica em "Visualizar como" em um usuário
4. É redirecionado para /dashboard
5. Vê o dashboard do usuário selecionado
6. Pode navegar por todas as páginas vendo dados do usuário
7. Clica em "Sair da Visualização" para voltar ao modo admin
```

---

**Desenvolvido com ❤️ para o Prizely CRM**
