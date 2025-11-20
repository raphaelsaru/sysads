# Prizely WhatsApp Exporter

Extensão do Google Chrome para exportar contatos do WhatsApp Web diretamente para o CRM Prizely.

## 📋 Descrição

Esta extensão permite que você exporte facilmente as informações de contato de uma conversa ativa no WhatsApp Web para o seu CRM Prizely, preenchendo automaticamente o nome e o número de telefone do contato.

## ✨ Funcionalidades

- 🔍 **Leitura automática** de nome e telefone do WhatsApp Web
- 📝 **Formulário completo** com todos os campos do CRM
- 🔄 **Campos condicionais** que aparecem baseados nas suas seleções
- 💰 **Formatação automática** de valores monetários
- 🔐 **Autenticação automática** usando sua sessão do CRM
- ✅ **Validações** de campos obrigatórios
- 🎨 **Interface moderna** e responsiva
- ⚙️ **Configurável** para diferentes ambientes (local/produção)

## 📦 Instalação

### Modo Desenvolvedor (Teste Local)

1. **Clone ou baixe o projeto:**
   ```bash
   cd /Users/charbellelopes/prizely/chrome-extension
   ```

2. **Gere os ícones PNG** (opcional, já existem placeholders):
   - Opção 1: Use uma ferramenta online (recomendado):
     - Acesse [SVGtoPNG.com](https://svgtopng.com) ou [CloudConvert](https://cloudconvert.com/svg-to-png)
     - Converta os arquivos `icon16.svg`, `icon48.svg`, `icon128.svg` para PNG
   
   - Opção 2: Use o script Node.js:
     ```bash
     npm install canvas
     node icons/convert-icons.js
     ```
   
   - Opção 3: Use os ícones placeholder já incluídos (funcionam, mas são básicos)

3. **Abra o Chrome e acesse:**
   ```
   chrome://extensions/
   ```

4. **Ative o "Modo do desenvolvedor"** (toggle no canto superior direito)

5. **Clique em "Carregar sem compactação"**

6. **Selecione a pasta** `chrome-extension`

7. **Pronto!** A extensão estará instalada e visível na barra de ferramentas

## ⚙️ Configuração

### Primeira Configuração

1. **Clique no ícone da extensão** na barra de ferramentas do Chrome

2. **Clique no botão "⚙️ Configurar"**

3. **Configure a URL do seu CRM:**
   - **Desenvolvimento local:** `http://localhost:3000`
   - **Produção:** `https://seu-dominio.vercel.app`

4. **Clique em "Salvar"**

### Autenticação

**IMPORTANTE:** Você precisa estar logado no CRM para usar a extensão.

1. Abra uma aba no Chrome com seu CRM
2. Faça login normalmente
3. A extensão usará automaticamente sua sessão autenticada

## 🚀 Como Usar

### Passo a Passo

1. **Acesse o WhatsApp Web** ([web.whatsapp.com](https://web.whatsapp.com))

2. **Abra uma conversa** com o contato que deseja exportar

3. **Clique no ícone da extensão** Prizely na barra de ferramentas

4. **Verifique os dados preenchidos automaticamente:**
   - Nome do contato
   - Número de telefone/Instagram

5. **Preencha os campos adicionais:**
   - Data de contato (preenchida com hoje por padrão)
   - Origem do contato
   - Orçamento enviado (Sim/Não)
   - Resultado (Venda, Orçamento em Processo, Não Venda)
   - Qualidade do contato (Bom, Regular, Ruim)
   - Cliente não respondeu (toggle)
   - Valor fechado (se orçamento foi enviado ou é venda)
   - Campos de pagamento (se for venda)
   - Data para chamar novamente
   - Observações

6. **Clique em "Enviar para CRM"**

7. **Aguarde a confirmação:** "✓ Cliente salvo com sucesso!"

8. O popup **fecha automaticamente** após o sucesso

## 📋 Campos do Formulário

### Campos Obrigatórios
- ✅ Data de contato
- ✅ Nome do cliente
- ✅ WhatsApp/Instagram
- ✅ Origem
- ✅ Resultado
- ✅ Qualidade do contato

### Campos Condicionais

#### Valor Fechado
Aparece quando:
- Orçamento enviado = Sim **OU**
- Resultado = Venda

#### Campos de Pagamento
Aparecem quando:
- Resultado = Venda

##### Dentro dos Campos de Pagamento:
- **Valor do Sinal** e **Data de Pagamento do Sinal**: Aparecem quando "Pagou Sinal" está marcado
- **Data de Pagamento Completo**: Aparece quando "Venda Paga" está marcado

## 🔍 Seletores do WhatsApp Web

A extensão tenta extrair informações usando múltiplos seletores para garantir compatibilidade:

### Nome do Contato
- `header span[data-testid="conversation-info-header-chat-title"]`
- `header ._2FzSG span[title]`
- `header .copyable-text span[title]`
- Outros seletores de fallback

### Número de Telefone
- Atributos `title` e `aria-label` do header
- URL da conversa
- Texto do header

## 🛠️ Estrutura de Arquivos

```
chrome-extension/
├── manifest.json          # Configuração da extensão (Manifest V3)
├── popup.html            # Interface do formulário
├── popup.js              # Lógica do formulário e integração com API
├── styles.css            # Estilos da interface
├── content.js            # Script que extrai dados do WhatsApp
├── background.js         # Service worker
├── icons/                # Ícones da extensão
│   ├── icon16.png        # 16x16 (barra de ferramentas)
│   ├── icon48.png        # 48x48 (gerenciador de extensões)
│   ├── icon128.png       # 128x128 (Chrome Web Store)
│   ├── icon16.svg        # Fonte SVG
│   ├── icon48.svg        # Fonte SVG
│   ├── icon128.svg       # Fonte SVG
│   ├── generate-icons.html  # Gerador visual de ícones
│   └── convert-icons.js  # Script de conversão SVG → PNG
└── README.md             # Este arquivo
```

## 🔒 Permissões

A extensão solicita as seguintes permissões:

- **storage**: Salvar configurações (URL do CRM)
- **activeTab**: Acessar a aba ativa do WhatsApp Web
- **cookies**: Usar autenticação do CRM via cookies

### Host Permissions:
- `https://web.whatsapp.com/*` - Para ler dados do WhatsApp
- `http://localhost:3000/*` - Para desenvolvimento local
- `https://*.vercel.app/*` - Para produção no Vercel

## 🐛 Solução de Problemas

### "Nenhuma conversa ativa"
- Certifique-se de que você abriu uma conversa no WhatsApp Web
- Não funciona na lista de conversas, apenas em conversas abertas

### "Não foi possível conectar ao CRM"
- Verifique se a URL do CRM está configurada corretamente (⚙️ Configurar)
- Teste a URL no navegador para garantir que está acessível
- Para desenvolvimento local, certifique-se de que o servidor está rodando

### "Não autenticado. Por favor, faça login no CRM primeiro"
- Abra uma aba com seu CRM
- Faça login normalmente
- Tente usar a extensão novamente

### "Não foi possível extrair o nome do contato"
- O WhatsApp Web pode ter atualizado sua estrutura HTML
- Recarregue a página do WhatsApp Web (F5)
- Se o problema persistir, abra uma issue no GitHub

### Extensão não aparece na barra de ferramentas
- Clique no ícone de quebra-cabeça (🧩) na barra de ferramentas
- Encontre "Prizely WhatsApp Exporter"
- Clique no ícone de pin para fixá-la na barra

## 🔄 Atualizações

### Para atualizar a extensão:

1. Acesse `chrome://extensions/`
2. Encontre "Prizely WhatsApp Exporter"
3. Clique em "Recarregar" (ícone de seta circular)

**OU**

Simplesmente feche e reabra o Chrome.

## 🧪 Desenvolvimento

### Testar Localmente

1. Configure o CRM para rodar em `http://localhost:3000`
   ```bash
   cd /Users/charbellelopes/prizely
   npm run dev
   ```

2. Configure a extensão para usar `http://localhost:3000`

3. Abra o WhatsApp Web e teste

### Debug

Para ver logs de debug:

1. Abra o popup da extensão
2. Clique com botão direito → "Inspecionar"
3. Veja o Console para logs do `popup.js`

Para ver logs do content script:

1. Abra o WhatsApp Web
2. F12 → Console
3. Veja logs do `content.js`

Para ver logs do background:

1. Acesse `chrome://extensions/`
2. Clique em "service worker" na extensão
3. Veja o Console

## 📝 Formato dos Dados Enviados

```json
{
  "dataContato": "2025-11-06",
  "nome": "João Silva",
  "whatsappInstagram": "+55 11 99999-9999",
  "origem": "Orgânico / Perfil",
  "orcamentoEnviado": "Não",
  "resultado": "Orçamento em Processo",
  "qualidadeContato": "Regular",
  "naoRespondeu": false,
  "valorFechado": "1500.00",
  "observacao": "Cliente interessado em tatuagem grande",
  "pagouSinal": false,
  "valorSinal": "",
  "dataPagamentoSinal": "",
  "vendaPaga": false,
  "dataPagamentoVenda": "",
  "dataLembreteChamada": "2025-11-13"
}
```

## 🔐 Segurança

- A extensão **não armazena** dados dos clientes
- Usa a **sessão existente** do navegador (cookies)
- **Não coleta** informações além do formulário
- Todos os dados vão **diretamente** para o seu CRM
- **Código aberto** - você pode auditar todo o código

## 📄 Licença

Este projeto é privado e de propriedade do Prizely CRM.

## 🆘 Suporte

Para suporte ou reportar bugs:
- Abra uma issue no repositório do GitHub
- Entre em contato com a equipe de desenvolvimento

## 🎯 Roadmap Futuro

- [ ] Suporte para grupos do WhatsApp
- [ ] Exportação em massa de múltiplos contatos
- [ ] Sincronização automática de mensagens
- [ ] Notificações de follow-up
- [ ] Estatísticas de conversão

---

**Versão:** 1.0.0  
**Última atualização:** Novembro 2025  
**Compatibilidade:** Chrome 88+, Manifest V3




