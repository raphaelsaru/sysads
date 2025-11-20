# 🐛 Guia de Debug - Prizely WhatsApp Exporter

## Problema: Sidebar não funciona após salvar URL do CRM

### Passos para Debug:

1. **Recarregue a extensão:**
   - Vá em `chrome://extensions/`
   - Clique em "Recarregar" na extensão Prizely

2. **Abra o Console do WhatsApp Web:**
   - No WhatsApp Web, pressione `F12` ou `Cmd+Option+I` (Mac)
   - Vá na aba "Console"

3. **Verifique os logs:**
   - Clique no ícone da extensão
   - Procure por mensagens que começam com `Prizely:`
   - Você deve ver:
     - `Prizely: Mensagem recebida: toggleSidebar`
     - `Prizely: Mostrando sidebar...`
     - `Prizely: Sidebar não existe, criando...` ou `Prizely: Sidebar existe, exibindo...`
     - `Prizely: Inicializando lógica da sidebar...`

4. **Verifique se a sidebar aparece:**
   - A sidebar deve aparecer à direita da tela
   - Se não aparecer, verifique se há erros no console

5. **Teste o envio:**
   - Preencha o formulário
   - Clique em "Enviar para CRM"
   - Verifique os logs no console:
     - `Prizely: URL do CRM carregada: [sua-url]`
     - `Prizely: Enviando dados para: [url]/api/clientes`
     - `Prizely: Resposta da API: [status]`

### Problemas Comuns:

#### 1. Sidebar não aparece
**Sintoma:** Clica no ícone mas nada acontece

**Soluções:**
- Verifique se está no WhatsApp Web (`web.whatsapp.com`)
- Recarregue a página do WhatsApp Web (F5)
- Recarregue a extensão
- Verifique o console para erros

#### 2. Erro ao conectar ao CRM
**Sintoma:** Mensagem de erro ao enviar

**Soluções:**
- Verifique se a URL do CRM está correta
- Verifique se o servidor do CRM está rodando
- Verifique se está logado no CRM (em outra aba)
- Teste a URL no navegador: `http://localhost:3000/api/clientes` (deve retornar erro 401 se não autenticado, mas não erro de conexão)

#### 3. Configurações não são salvas
**Sintoma:** URL não persiste após salvar

**Soluções:**
- Verifique se há erros no console
- Tente salvar novamente
- Verifique se a URL está no formato correto (ex: `http://localhost:3000`)

### Logs Esperados:

**Ao abrir a sidebar:**
```
Prizely: Mensagem recebida: toggleSidebar
Prizely: Mostrando sidebar...
Prizely: Sidebar não existe, criando...
Prizely: Sidebar criada, exibindo...
Prizely: Inicializando lógica da sidebar...
Prizely: Configurando event listeners...
```

**Ao enviar formulário:**
```
Prizely: URL do CRM carregada: http://localhost:3000
Prizely: Enviando dados para: http://localhost:3000/api/clientes
Prizely: Dados do formulário: {nome: "...", ...}
Prizely: Resposta da API: 201 Created
Prizely: Cliente salvo com sucesso: {...}
```

### Como Reportar um Bug:

Se o problema persistir, forneça:
1. Mensagens do console (copy/paste)
2. URL do CRM configurada
3. Versão do Chrome
4. Passos para reproduzir o problema




