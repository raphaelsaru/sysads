# 🧪 Guia de Testes - Prizely WhatsApp Exporter

## Checklist de Testes Completo

### ✅ Instalação e Configuração

- [ ] Extensão instala sem erros no Chrome
- [ ] Ícone aparece na barra de ferramentas
- [ ] Modal de configurações abre e fecha corretamente
- [ ] URL do CRM é salva e persiste após recarregar
- [ ] Validação de URL funciona (rejeita URLs inválidas)

### ✅ Extração de Dados do WhatsApp

**Pré-requisitos:**
- WhatsApp Web aberto
- Conversa individual aberta (não grupo)

**Testes:**

- [ ] **Nome do contato** é extraído corretamente
  - Teste com contato salvo
  - Teste com número não salvo
  - Teste com contato com nome composto

- [ ] **Número de telefone** é extraído
  - Com código de país (+55)
  - Formato correto
  - Fallback para nome se não encontrar número

- [ ] **Validações**
  - Erro quando nenhuma conversa está aberta
  - Erro quando está na lista de conversas
  - Mensagem de erro clara e útil

### ✅ Formulário

**Campos Obrigatórios:**
- [ ] Data de contato é preenchida com hoje
- [ ] Nome é preenchido do WhatsApp
- [ ] WhatsApp/Instagram é preenchido
- [ ] Não permite enviar sem nome
- [ ] Não permite enviar sem WhatsApp/Instagram
- [ ] Não permite enviar sem data

**Campos de Seleção:**
- [ ] Origem tem todas as opções: Indicação, Orgânico/Perfil, Anúncio, Cliente antigo
- [ ] Resultado tem: Venda, Orçamento em Processo, Não Venda
- [ ] Qualidade tem: Bom, Regular, Ruim
- [ ] Valores padrão corretos (Orgânico/Perfil, Regular, Orçamento em Processo)

**Toggles:**
- [ ] Orçamento Enviado liga/desliga corretamente
- [ ] Cliente Não Respondeu liga/desliga
- [ ] Pagou Sinal liga/desliga
- [ ] Venda Paga liga/desliga
- [ ] Visual do switch é claro

### ✅ Campos Condicionais

**Valor Fechado:**
- [ ] Aparece quando Orçamento Enviado = Sim
- [ ] Aparece quando Resultado = Venda
- [ ] Some quando Orçamento Enviado = Não E Resultado ≠ Venda

**Seção de Pagamento:**
- [ ] Aparece quando Resultado = Venda
- [ ] Some quando Resultado ≠ Venda
- [ ] Todos os campos da seção aparecem/somem juntos

**Campos de Sinal:**
- [ ] Valor do Sinal aparece quando Pagou Sinal = true
- [ ] Data Pagamento Sinal aparece quando Pagou Sinal = true
- [ ] Ambos somem quando Pagou Sinal = false
- [ ] São obrigatórios quando visíveis

**Data Pagamento Venda:**
- [ ] Aparece quando Venda Paga = true
- [ ] Some quando Venda Paga = false
- [ ] É obrigatória quando visível

### ✅ Formatação de Moeda

**Valor Fechado:**
- [ ] Formata automaticamente enquanto digita
- [ ] Formato: R$ 0,00
- [ ] Aceita apenas números
- [ ] Remove caracteres inválidos
- [ ] Preenche com R$ 0,00 ao focar (se vazio)

**Valor do Sinal:**
- [ ] Mesmas validações do Valor Fechado
- [ ] Funciona independentemente

### ✅ Datas

- [ ] Data de Contato aceita seleção de data
- [ ] Data Pagamento Sinal aceita seleção
- [ ] Data Pagamento Venda aceita seleção
- [ ] Data para Chamar Novamente aceita seleção
- [ ] Formato correto (YYYY-MM-DD)

### ✅ Validações

**Antes de Enviar:**
- [ ] Valida campos obrigatórios básicos
- [ ] Valida Valor do Sinal se Pagou Sinal = true
- [ ] Valida Data Pagamento Sinal se Pagou Sinal = true
- [ ] Valida Data Pagamento Venda se Venda Paga = true
- [ ] Mostra mensagem de erro clara

### ✅ Integração com API

**Setup de Teste:**
```bash
# Terminal 1: Rodar o CRM
cd /Users/charbellelopes/prizely
npm run dev

# Navegador: Fazer login no CRM
# Abrir em: http://localhost:3000
```

**Testes de Sucesso:**
- [ ] POST enviado para `/api/clientes`
- [ ] Headers corretos (Content-Type: application/json)
- [ ] Credentials: include enviado
- [ ] Payload no formato correto
- [ ] Cliente criado no banco de dados
- [ ] Mensagem de sucesso mostrada
- [ ] Popup fecha após 2 segundos

**Testes de Erro:**
- [ ] **Erro 401** (não autenticado):
  - Fazer logout do CRM
  - Tentar enviar formulário
  - Deve mostrar: "Não autenticado. Por favor, faça login no CRM primeiro."

- [ ] **Erro de Rede**:
  - Parar servidor do CRM
  - Tentar enviar formulário
  - Deve mostrar: "Não foi possível conectar ao CRM..."

- [ ] **URL Inválida**:
  - Configurar URL errada (ex: http://localhost:9999)
  - Deve dar erro de conexão

### ✅ Estados Visuais

**Loading:**
- [ ] Botão desabilita durante envio
- [ ] Texto "Enviar para CRM" some
- [ ] Spinner aparece
- [ ] Não é possível clicar novamente

**Sucesso:**
- [ ] Mensagem verde aparece
- [ ] Texto: "✓ Cliente salvo com sucesso!"
- [ ] Popup fecha automaticamente após 2s
- [ ] Formulário não pode ser submetido novamente

**Erro:**
- [ ] Mensagem vermelha aparece
- [ ] Texto do erro é descritivo
- [ ] Botão é reabilitado
- [ ] Possível tentar novamente
- [ ] Mensagem some após 5s

### ✅ Design e UX

**Visual:**
- [ ] Design limpo e profissional
- [ ] Cores consistentes (azul #3B82F6)
- [ ] Espaçamento adequado
- [ ] Sem elementos cortados
- [ ] Scrollbar customizada

**Interatividade:**
- [ ] Hover states nos botões funcionam
- [ ] Focus states nos inputs são visíveis
- [ ] Transições são suaves
- [ ] Toggles animam corretamente
- [ ] Modal de configurações abre suavemente

**Responsividade:**
- [ ] Popup tem largura fixa (450px)
- [ ] Altura ajusta ao conteúdo (max 600px)
- [ ] Scroll funciona corretamente
- [ ] Todos os elementos são clicáveis
- [ ] Não há overlaps

### ✅ Persistência de Dados

**chrome.storage:**
- [ ] URL do CRM é salva
- [ ] URL persiste após fechar o Chrome
- [ ] URL persiste após recarregar extensão
- [ ] Não salva dados dos clientes
- [ ] Não salva dados sensíveis

**Formulário:**
- [ ] Dados do WhatsApp carregam ao abrir
- [ ] Formulário limpa após envio bem-sucedido
- [ ] Configurações não afetam dados do formulário

### ✅ Casos Extremos

**WhatsApp:**
- [ ] Contato com nome muito longo
- [ ] Contato com caracteres especiais (émojis)
- [ ] Número com formato internacional
- [ ] Número sem código de país
- [ ] Contato sem foto de perfil

**Formulário:**
- [ ] Texto muito longo em Observações
- [ ] Valores monetários muito altos
- [ ] Datas futuras
- [ ] Datas passadas antigas
- [ ] Todos os campos vazios (exceto obrigatórios)

**API:**
- [ ] Timeout de rede (conexão lenta)
- [ ] Resposta malformada do servidor
- [ ] Token expirado
- [ ] Servidor retorna 500
- [ ] CORS bloqueado

### ✅ Segurança

- [ ] Não armazena senhas
- [ ] Não armazena tokens manualmente
- [ ] Usa cookies do navegador (HttpOnly)
- [ ] Não faz XSS
- [ ] Não expõe dados sensíveis no console
- [ ] Permissões mínimas necessárias

### ✅ Performance

- [ ] Popup abre em < 1 segundo
- [ ] Extração de dados do WhatsApp é instantânea
- [ ] Envio para API em < 3 segundos (rede normal)
- [ ] Sem memory leaks (abrir/fechar várias vezes)
- [ ] Sem travamentos

### ✅ Compatibilidade

**Navegadores:**
- [ ] Chrome versão 88+
- [ ] Microsoft Edge (Chromium)
- [ ] Brave
- [ ] Opera

**WhatsApp Web:**
- [ ] Versão atual (2025)
- [ ] Interface em Português
- [ ] Interface em Inglês
- [ ] Tema claro
- [ ] Tema escuro

---

## 🎯 Cenários de Teste Completos

### Cenário 1: Fluxo Feliz Completo
```
1. Instalar extensão
2. Configurar URL: http://localhost:3000
3. Fazer login no CRM
4. Abrir WhatsApp Web
5. Abrir conversa com contato
6. Clicar na extensão
7. Verificar dados preenchidos
8. Preencher campos adicionais
9. Marcar "Resultado = Venda"
10. Preencher valor fechado: R$ 1.500,00
11. Marcar "Pagou Sinal"
12. Preencher valor sinal: R$ 500,00
13. Selecionar data do sinal: hoje
14. Adicionar observação
15. Clicar "Enviar para CRM"
16. Ver mensagem de sucesso
17. Verificar no CRM que o cliente foi criado
✅ Sucesso esperado
```

### Cenário 2: Sem Autenticação
```
1. NÃO fazer login no CRM
2. Abrir WhatsApp Web
3. Abrir conversa
4. Abrir extensão
5. Preencher formulário
6. Clicar "Enviar para CRM"
❌ Erro esperado: "Não autenticado"
```

### Cenário 3: Campos Condicionais
```
1. Abrir extensão
2. Marcar "Orçamento Enviado = Sim"
   ✅ Campo "Valor Fechado" deve aparecer
3. Desmarcar "Orçamento Enviado"
   ✅ Campo "Valor Fechado" deve sumir
4. Selecionar "Resultado = Venda"
   ✅ Campo "Valor Fechado" deve aparecer
   ✅ Seção "Pagamento" deve aparecer
5. Marcar "Pagou Sinal"
   ✅ Campos de sinal devem aparecer
6. Desmarcar "Pagou Sinal"
   ✅ Campos de sinal devem sumir
```

### Cenário 4: Validações
```
1. Abrir extensão
2. Limpar campo "Nome"
3. Clicar "Enviar para CRM"
   ❌ Erro: "Nome do cliente é obrigatório"
4. Preencher nome
5. Selecionar "Resultado = Venda"
6. Marcar "Pagou Sinal"
7. NÃO preencher valor do sinal
8. Clicar "Enviar"
   ❌ Erro: "Valor do sinal é obrigatório..."
```

---

## 📊 Relatório de Testes

Use este template para reportar resultados:

```
Data: ___/___/2025
Testador: __________
Versão: 1.0.0

[ ] Instalação: PASSOU / FALHOU
[ ] Extração WhatsApp: PASSOU / FALHOU
[ ] Formulário: PASSOU / FALHOU
[ ] Campos Condicionais: PASSOU / FALHOU
[ ] Validações: PASSOU / FALHOU
[ ] Integração API: PASSOU / FALHOU
[ ] Estados Visuais: PASSOU / FALHOU
[ ] Design/UX: PASSOU / FALHOU

Bugs encontrados:
1. ___________
2. ___________

Sugestões:
1. ___________
2. ___________
```

---

## 🐛 Bugs Conhecidos

Nenhum bug conhecido no momento.

---

## ✅ Pronto para Produção?

A extensão está pronta quando:
- [ ] Todos os testes acima passam
- [ ] Nenhum bug crítico
- [ ] Documentação completa
- [ ] Ícones finais instalados
- [ ] Testado em ambiente de produção
- [ ] Aprovação do usuário final

---

**Última atualização:** 6 de Novembro de 2025




