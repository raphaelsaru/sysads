# 📝 Changelog - Prizely WhatsApp Exporter

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [1.0.0] - 2025-11-06

### ✨ Adicionado
- Primeira versão funcional da extensão
- Extração automática de nome e telefone do WhatsApp Web
- Formulário completo com todos os campos do CRM
- Campos condicionais inteligentes
- Formatação automática de valores monetários
- Integração com API `/api/clientes` do CRM
- Autenticação via cookies existentes
- Estados de loading, sucesso e erro
- Modal de configurações
- Persistência de configurações com chrome.storage
- Validações de formulário
- Design moderno e responsivo
- Documentação completa
- Guias de instalação e teste

### 🔒 Segurança
- Usa apenas permissões mínimas necessárias
- Não armazena dados sensíveis
- Usa autenticação via cookies HttpOnly
- Código auditável

### 📁 Arquivos
- manifest.json (Manifest V3)
- popup.html, popup.js, styles.css
- content.js (extração de dados)
- background.js (service worker)
- Ícones em PNG e SVG
- README.md completo
- QUICK-START.md
- TESTING-GUIDE.md
- IMPLEMENTATION-SUMMARY.md

### 🎯 Funcionalidades
- ✅ Leitura passiva do WhatsApp Web
- ✅ 15 campos do formulário
- ✅ Campos condicionais (4 regras)
- ✅ Formatação de moeda brasileira
- ✅ Validações (6 tipos)
- ✅ Estados visuais (3 estados)
- ✅ Configuração de URL
- ✅ Multi-ambiente (dev/prod)

---

## [Unreleased]

### 🚀 Possíveis Melhorias Futuras
- Suporte para grupos do WhatsApp
- Exportação em massa de contatos
- Sincronização de mensagens
- Notificações de follow-up
- Estatísticas inline
- Temas (claro/escuro)
- Atalhos de teclado
- Histórico de exportações
- Validação de duplicatas
- Auto-preenchimento inteligente

---

**Formato:** Baseado em [Keep a Changelog](https://keepachangelog.com/)
**Versionamento:** [Semantic Versioning](https://semver.org/)
