// Content Script - Extrai informações do contato ativo no WhatsApp Web e mostra modal

console.log('Prizely WhatsApp Exporter: Content script carregado');

const INVALID_NAME_KEYWORDS = [
  // UI genérica do WhatsApp
  'wa-wordmark', 'whatsapp', 'search', 'pesquisar', 'new-chat', 'novo chat', 'new chat',
  'outline', 'menu', 'status', 'comunidades', 'communities', 'notifications', 'notificações',
  'configurações', 'settings', 'mensagens', 'messages', 'arquivos', 'files',
  
  // Status de presença
  'online', 'offline', 'digitando', 'typing', 'gravando', 'recording', 'visto', 'seen',
  
  // Ações de grupo
  'entrada', 'saída', 'entrou', 'saiu', 'grupo', 'group', 'participantes', 'participants',
  'membros', 'members', 'adicionar', 'add', 'remover', 'remove', 'sair', 'leave',
  'admin', 'administrador',
  
  // Ações de contato
  'silenciar', 'mute', 'arquivar', 'archive', 'favoritar', 'favorite',
  'bloquear', 'block', 'desbloquear', 'unblock', 'excluir', 'delete', 'limpar', 'clear',
  
  // UI comum
  'buscar', 'find', 'mais', 'more', 'menos', 'less', 'ver mais', 'see more', 'ver menos', 'see less',
  'carregando', 'loading', 'carregar', 'load', 'enviar', 'send', 'enviando', 'sending',
  'enviado', 'sent', 'entregue', 'delivered', 'lido', 'read', 'erro', 'error', 'falha', 'failed',
  'tentar novamente', 'try again', 'cancelar', 'cancel', 'confirmar', 'confirm',
  'salvar', 'save', 'editar', 'edit', 'novo', 'new', 'criar', 'create',
  'fechar', 'close', 'abrir', 'open'
];

function sanitizeNameCandidate(value) {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').replace(/^~\s*/, '').trim();
  if (!normalized) return '';

  const lower = normalized.toLowerCase();
  
  // Verificar se contém apenas palavras inválidas (ex: "online, online")
  const words = lower.split(/[\s,;]+/).filter(w => w.length > 0);
  if (words.length > 0 && words.every(word => INVALID_NAME_KEYWORDS.some(kw => word === kw || word.includes(kw)))) {
    return '';
  }
  
  // Verificar se contém palavras inválidas
  if (INVALID_NAME_KEYWORDS.some((keyword) => {
    // Match exato ou como palavra completa
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lower);
  })) {
    return '';
  }

  if (normalized.length > 100) {
    return '';
  }

  // Se for apenas um caractere e não for número, descartar
  if (normalized.length === 1 && !/^\d$/.test(normalized)) {
    return '';
  }

  return normalized;
}

function isElementInContactContext(element) {
  if (!element) return false;
  return !!(
    element.closest('#main') ||
    element.closest('[data-testid="conversation-panel-body"]') ||
    element.closest('[data-testid="conversation-panel-wrapper"]') ||
    element.closest('div[data-testid="contact-info-drawer"]') ||
    element.closest('div[data-testid="drawer-right"]')
  );
}

function getConversationHeaderElements() {
  const selectors = [
    '#main header span[data-testid="conversation-info-header-chat-title"]',
    '#main header div[data-testid="conversation-info-header"] span[title]',
    '#main header div[data-testid="conversation-header"] span[title]',
    '#main header [data-testid="conversation-info-header-chat-title"]',
    'header[data-testid="conversation-header"] span[title]',
    'header[data-testid="conversation-header"] [data-testid="conversation-info-header-chat-title"]',
    'header[data-testid="conversation-header"] span[dir="auto"]',
    'header span[data-testid="conversation-info-header-chat-title"]',
    'header div[data-testid="conversation-info-header"] span[title]',
    '#main header .selectable-text.copyable-text',
    '#main header .selectable-text.copyable-text > *'
  ];

  const elements = [];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (isElementInContactContext(el)) {
        elements.push(el);
      }
    });
  });
  return elements;
}

function getHeaderNameCandidate() {
  const headerElements = getConversationHeaderElements();
  for (const element of headerElements) {
    const candidates = [
      sanitizeNameCandidate(element.textContent),
      sanitizeNameCandidate(element.getAttribute('title')),
      sanitizeNameCandidate(element.getAttribute('aria-label'))
    ];
    for (const candidate of candidates) {
      if (candidate) {
        return candidate;
      }
    }
  }
  return '';
}

// =====================================================
// FUNÇÕES DE EXTRAÇÃO DE DADOS DO WHATSAPP
// =====================================================

/**
 * Tenta acessar o estado React do WhatsApp Web
 * Muitas extensões modernas usam essa abordagem
 */
function tryGetWhatsAppStore() {
  try {
    // ESTRATÉGIA 1: WhatsApp Web expõe o Store globalmente em algumas versões
    if (window.Store) {
      // Tentar diferentes caminhos para o chat ativo
      const chatMethods = [
        () => window.Store.Chat?.getActive?.(),
        () => window.Store.default?.Chat?.getActive?.(),
        () => window.Store.chat?.getActive?.(),
        () => window.Store.msg?.getActiveChat?.(),
      ];
      
      for (const getChat of chatMethods) {
        try {
          const activeChat = getChat();
          if (activeChat) {
            const name = activeChat.contact?.pushname || 
                        activeChat.contact?.name || 
                        activeChat.contact?.displayName ||
                        activeChat.name ||
                        activeChat.formattedTitle;
            const phone = activeChat.id?.user || 
                         activeChat.contact?.id?.user ||
                         activeChat.contact?.number ||
                         activeChat.phoneNumber;
            
            if (name || phone) {
              console.log('Prizely: ✅ Dados encontrados via window.Store:', { name, phone });
              return { name, phone };
            }
          }
        } catch (e) {
          // Continuar tentando
        }
      }
    }
    
    // ESTRATÉGIA 2: Tentar via webpack chunks
    if (window.webpackChunkwhatsapp_web) {
      const modules = window.webpackChunkwhatsapp_web;
      for (const chunk of modules) {
        if (chunk && Array.isArray(chunk[1])) {
          for (const module of chunk[1]) {
            if (module && typeof module === 'object' && module.exports) {
              const exp = module.exports;
              // Tentar diferentes estruturas
              const chatAccessors = [
                () => exp.default?.Chat?.getActive?.(),
                () => exp.Chat?.getActive?.(),
                () => exp.getActiveChat?.(),
                () => exp.default?.getActiveChat?.(),
              ];
              
              for (const getChat of chatAccessors) {
                try {
                  const activeChat = getChat();
                  if (activeChat) {
                    const name = activeChat.contact?.pushname || 
                                activeChat.contact?.name || 
                                activeChat.contact?.displayName ||
                                activeChat.name ||
                                activeChat.formattedTitle;
                    const phone = activeChat.id?.user || 
                                 activeChat.contact?.id?.user ||
                                 activeChat.contact?.number ||
                                 activeChat.phoneNumber;
                    
                    if (name || phone) {
                      console.log('Prizely: ✅ Dados encontrados via webpack:', { name, phone });
                      return { name, phone };
                    }
                  }
                } catch (e) {
                  // Continuar tentando
                }
              }
            }
          }
        }
      }
    }
    
    // ESTRATÉGIA 3: Tentar acessar via React DevTools (se disponível)
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      try {
        const reactInstances = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
        // Esta é uma abordagem mais avançada, mas pode funcionar
      } catch (e) {
        // Ignorar
      }
    }
  } catch (error) {
    console.log('Prizely: Não foi possível acessar Store do WhatsApp:', error.message);
  }
  return null;
}

/**
 * Extrai o nome do contato usando abordagem moderna e robusta
 * Baseado na estrutura HTML fornecida pelo usuário
 */
function extractContactName() {
  console.log('Prizely: Tentando extrair nome do contato (abordagem moderna)...');
  
  // Buscar o header uma vez para reutilizar em múltiplas estratégias
  const header = document.querySelector('#main header, header[role="banner"]');
  
  // ESTRATÉGIA 1: Tentar acessar o estado React do WhatsApp (mais confiável)
  const storeData = tryGetWhatsAppStore();
  if (storeData && storeData.name) {
    const name = sanitizeNameCandidate(storeData.name);
    if (name) {
      console.log('Prizely: ✅ Nome encontrado via WhatsApp Store:', name);
      return name;
    }
  }
  
  // ESTRATÉGIA 2: Buscar elementos com selectable-text.copyable-text e dir="auto" no header
  // Baseado na estrutura HTML fornecida: <span dir="auto" class="x1rg5ohu x13faqbe _ao3e selectable-text copyable-text">
  // Priorizar elementos que estão mais no topo do header (geralmente contêm o nome)
  if (header) {
    const headerSelectableTexts = Array.from(header.querySelectorAll('span.selectable-text.copyable-text[dir="auto"], div.selectable-text.copyable-text[dir="auto"]'));
    
    // Ordenar por posição no DOM (elementos mais acima primeiro)
    headerSelectableTexts.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.top - bRect.top;
    });
    
    for (const element of headerSelectableTexts) {
      const text = element.textContent?.trim();
      if (text) {
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1 && candidate.length < 100) {
          // Verificar se não é um número de telefone
          if (!/^\+?\d[\d\s\-()]{8,}$/.test(candidate)) {
            // Verificar se não está em um contexto de status (ex: dentro de um elemento que contém "online")
            const parentText = element.parentElement?.textContent?.toLowerCase() || '';
            if (!parentText.includes('online') && !parentText.includes('offline') && !parentText.includes('digitando')) {
              console.log('Prizely: ✅ Nome encontrado via selectable-text no header:', candidate);
              return candidate;
            }
          }
        }
      }
    }
  }
  
  // ESTRATÉGIA 3: Buscar no painel de informações (quando aberto)
  // Baseado na estrutura: <div class="x1fcty0u xhslqc4 x6prxxf x1o2sk6j">~Paula</div>
  const drawer = document.querySelector('div[data-testid="contact-info-drawer"], div[data-testid="drawer-right"]');
  if (drawer) {
    // Buscar divs com texto que parecem nomes (não números)
    const drawerTexts = drawer.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    for (const element of drawerTexts) {
      const text = element.textContent?.trim();
      if (text) {
        const candidate = sanitizeNameCandidate(text);
        // Se começa com ~, remover
        const cleanCandidate = candidate.replace(/^~\s*/, '');
        if (cleanCandidate && cleanCandidate.length > 1 && cleanCandidate.length < 100) {
          // Não deve ser um número de telefone
          if (!/^\+?\d[\d\s\-()]{8,}$/.test(cleanCandidate)) {
            console.log('Prizely: ✅ Nome encontrado via painel de informações:', cleanCandidate);
            return cleanCandidate;
          }
        }
      }
    }
  }
  
  // ESTRATÉGIA 4: Buscar elementos com data-testid específicos
  const testIdSelectors = [
    '#main header span[data-testid="conversation-info-header-chat-title"]',
    'div[data-testid="contact-info-drawer"] span[data-testid="contact-info-title"]',
    'div[data-testid="drawer-right"] span[data-testid="contact-info-title"]'
  ];
  
  for (const selector of testIdSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const candidates = [
        sanitizeNameCandidate(element.textContent),
        sanitizeNameCandidate(element.getAttribute('title')),
        sanitizeNameCandidate(element.getAttribute('aria-label'))
      ];
      for (const candidate of candidates) {
        if (candidate && candidate.length > 1 && candidate.length < 100) {
          if (!/^\+?\d[\d\s\-()]{8,}$/.test(candidate)) {
            console.log(`Prizely: ✅ Nome encontrado via data-testid "${selector}":`, candidate);
            return candidate;
          }
        }
      }
    }
  }
  
  // ESTRATÉGIA 5: Buscar qualquer texto no header que pareça um nome
  if (header) {
    // Buscar todos os spans e divs com texto
    const textElements = header.querySelectorAll('span[dir="auto"], div[dir="auto"], span.selectable-text, div.selectable-text');
    for (const element of textElements) {
      const text = element.textContent?.trim();
      if (text) {
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1 && candidate.length < 100) {
          // Não deve ser um número de telefone
          if (!/^\+?\d[\d\s\-()]{8,}$/.test(candidate)) {
            console.log('Prizely: ✅ Nome encontrado via análise do header:', candidate);
            return candidate;
          }
        }
      }
    }
  }
  
  console.warn('Prizely: ⚠️ Não foi possível extrair o nome do contato');
  return '';
}

/**
 * Extrai o número de telefone do contato usando abordagem moderna
 * Baseado na estrutura HTML fornecida: <span dir="auto" class="x1rg5ohu x13faqbe _ao3e selectable-text copyable-text">+55 11 98390-5029</span>
 */
function extractContactPhone() {
  console.log('Prizely: Tentando extrair telefone do contato (abordagem moderna)...');
  
  // ESTRATÉGIA 1: Tentar acessar o estado React do WhatsApp (mais confiável)
  const storeData = tryGetWhatsAppStore();
  if (storeData && storeData.phone) {
    const phone = '+' + storeData.phone.replace(/\D/g, '');
    if (phone.length >= 12) { // Mínimo: +5511999999999
      console.log('Prizely: ✅ Telefone encontrado via WhatsApp Store:', phone);
      return phone;
    }
  }
  
  // ESTRATÉGIA 2: Extrair da URL (muito confiável)
  const urlMatch = window.location.href.match(/\/chat\/(\d+)/) || window.location.href.match(/\/(\d{10,})$/);
  if (urlMatch && urlMatch[1]) {
    const phone = '+' + urlMatch[1];
    console.log('Prizely: ✅ Telefone encontrado via URL:', phone);
    return phone;
  }
  
  // ESTRATÉGIA 3: Buscar no painel de informações (quando aberto)
  // Baseado na estrutura: <span dir="auto" class="... selectable-text copyable-text">+55 11 98390-5029</span>
  const drawer = document.querySelector('div[data-testid="contact-info-drawer"], div[data-testid="drawer-right"]');
  if (drawer) {
    // Buscar elementos com selectable-text que contenham números
    const phoneElements = drawer.querySelectorAll('span.selectable-text.copyable-text[dir="auto"], div.selectable-text.copyable-text[dir="auto"]');
    for (const element of phoneElements) {
      const text = element.textContent?.trim();
      if (text) {
        // Procurar por padrão de telefone
        const phoneMatch = text.match(/(\+?\d[\d\s\-()]{8,})/);
        if (phoneMatch) {
          const phone = phoneMatch[0].trim();
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            const formattedPhone = '+' + cleanPhone;
            console.log('Prizely: ✅ Telefone encontrado via painel de informações:', formattedPhone);
            return formattedPhone;
          }
        }
      }
    }
    
    // Buscar especificamente por data-testid="phone-number"
    const phoneNumberElement = drawer.querySelector('div[data-testid="phone-number"]');
    if (phoneNumberElement) {
      const text = phoneNumberElement.textContent?.trim();
      if (text) {
        const phoneMatch = text.match(/(\+?\d[\d\s\-()]{8,})/);
        if (phoneMatch) {
          const phone = phoneMatch[0].trim();
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            const formattedPhone = '+' + cleanPhone;
            console.log('Prizely: ✅ Telefone encontrado via data-testid="phone-number":', formattedPhone);
            return formattedPhone;
          }
        }
      }
    }
  }
  
  // ESTRATÉGIA 4: Buscar no header por elementos com números
  const header = document.querySelector('#main header, header[role="banner"]');
  if (header) {
    const headerTexts = header.querySelectorAll('span.selectable-text.copyable-text[dir="auto"], span[title], span[aria-label]');
    for (const element of headerTexts) {
      const possibleValues = [
        element.textContent,
        element.getAttribute('title'),
        element.getAttribute('aria-label')
      ];
      
      for (const value of possibleValues) {
        if (!value) continue;
        const phoneMatch = value.match(/(\+?\d[\d\s\-()]{8,})/);
        if (phoneMatch) {
          const phone = phoneMatch[0].trim();
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            const formattedPhone = '+' + cleanPhone;
            console.log('Prizely: ✅ Telefone encontrado via header:', formattedPhone);
            return formattedPhone;
          }
        }
      }
    }
  }
  
  // ESTRATÉGIA 5: Buscar em todo o documento por padrões de telefone em elementos relevantes
  const allSelectableTexts = document.querySelectorAll('span.selectable-text.copyable-text[dir="auto"]');
  for (const element of allSelectableTexts) {
    const text = element.textContent?.trim();
    if (text) {
      const phoneMatch = text.match(/^(\+?\d[\d\s\-()]{8,})$/);
      if (phoneMatch) {
        const phone = phoneMatch[0].trim();
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          // Verificar se está em contexto relevante (header ou drawer)
          if (element.closest('#main header') || element.closest('div[data-testid="contact-info-drawer"], div[data-testid="drawer-right"]')) {
            const formattedPhone = '+' + cleanPhone;
            console.log('Prizely: ✅ Telefone encontrado via selectable-text:', formattedPhone);
            return formattedPhone;
          }
        }
      }
    }
  }
  
  console.warn('Prizely: ⚠️ Não foi possível extrair o telefone do contato');
  return '';
}

/**
 * Verifica se há uma conversa ativa aberta (versão moderna e robusta)
 */
function isConversationActive() {
  console.log('Prizely: Verificando se há conversa ativa...');
  
  // ESTRATÉGIA 1: Verificar URL (mais confiável)
  const urlHasChat = window.location.href.includes('/chat/');
  if (urlHasChat) {
    console.log('Prizely: ✅ Conversa ativa detectada via URL');
    return true;
  }
  
  // ESTRATÉGIA 2: Tentar acessar Store do WhatsApp
  const storeData = tryGetWhatsAppStore();
  if (storeData && (storeData.name || storeData.phone)) {
    console.log('Prizely: ✅ Conversa ativa detectada via WhatsApp Store');
    return true;
  }
  
  // ESTRATÉGIA 3: Verificar se há elementos de conversa no DOM
  const chatPanelSelectors = [
    '[data-testid="conversation-panel-body"]',
    '[data-testid="conversation-panel-wrapper"]',
    '[data-testid="conversation-panel"]',
    '#main header span.selectable-text.copyable-text[dir="auto"]'
  ];
  
  for (const selector of chatPanelSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      // Verificar se o elemento tem conteúdo válido (não vazio e não é UI genérica)
      const text = element.textContent?.trim();
      if (text && text.length > 0) {
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1) {
          console.log(`Prizely: ✅ Conversa ativa detectada via "${selector}"`);
          return true;
        }
      }
    }
  }
  
  // ESTRATÉGIA 4: Verificar se há header com conteúdo válido
  const header = document.querySelector('#main header, header[role="banner"]');
  if (header) {
    const headerTexts = header.querySelectorAll('span[dir="auto"], span.selectable-text');
    for (const element of headerTexts) {
      const text = element.textContent?.trim();
      if (text) {
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1 && candidate.length < 100) {
          // Não deve ser um número puro (pode ser nome ou telefone formatado)
          if (!/^\d+$/.test(candidate.replace(/\D/g, ''))) {
            console.log('Prizely: ✅ Conversa ativa detectada via header com conteúdo válido');
            return true;
          }
        }
      }
    }
  }
  
  console.log('Prizely: ⚠️ Nenhuma conversa ativa detectada');
  return false;
}

/**
 * Verifica se o painel de informações do contato está aberto
 */
function isContactInfoPanelOpen() {
  const drawer = document.querySelector('div[data-testid="contact-info-drawer"], div[data-testid="drawer-right"]');
  return !!drawer;
}

/**
 * Extrai as informações do contato
 */
function extractContactInfo() {
  console.log('Prizely: Iniciando extração de dados do contato...');
  
  // Tentar extrair mesmo sem conversa "ativa" detectada
  const name = extractContactName();
  const phone = extractContactPhone();
  const panelOpen = isContactInfoPanelOpen();
  const conversationActive = isConversationActive();

  console.log('Prizely: Conversa ativa detectada?', conversationActive);
  console.log('Prizely: Painel de informações aberto?', panelOpen);
  console.log('Prizely: Nome extraído:', name);
  console.log('Prizely: Telefone extraído:', phone);

  // Se conseguiu extrair nome, considerar sucesso mesmo sem detectar conversa ativa
  if (name) {
    return {
      success: true,
      data: {
        nome: name,
        whatsappInstagram: phone || name
      },
      panelOpen: panelOpen
    };
  }

  // Se não conseguiu extrair nome, verificar se há conversa ativa
  if (!conversationActive) {
    console.warn('Prizely: Nenhuma conversa ativa e não conseguiu extrair nome');
    return {
      success: false,
      error: 'Nenhuma conversa ativa. Por favor, abra uma conversa no WhatsApp Web.',
      needsPanel: false
    };
  }

  // Há conversa mas não conseguiu extrair nome
  return {
    success: false,
    error: 'Não foi possível extrair o nome do contato. Tente clicar no nome do contato no topo.',
    needsPanel: true
  };
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

function getTodayBR() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  if (!value) return '';
  const numericValue = value.replace(/\D/g, '');
  const number = parseInt(numericValue) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
}

function parseCurrency(value) {
  if (!value) return '';
  return (parseInt(value.replace(/\D/g, '')) / 100).toFixed(2);
}

// =====================================================
// INJEÇÃO DE CSS E HTML
// =====================================================

/**
 * Injeta o CSS do modal
 */
function injectModalCSS() {
  if (document.getElementById('prizely-modal-styles')) {
    return; // Já foi injetado
  }

  const link = document.createElement('link');
  link.id = 'prizely-modal-styles';
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('modal.css');
  document.head.appendChild(link);

  const linkStyles = document.createElement('link');
  linkStyles.id = 'prizely-form-styles';
  linkStyles.rel = 'stylesheet';
  linkStyles.href = chrome.runtime.getURL('styles.css');
  document.head.appendChild(linkStyles);
}

/**
 * Injeta o HTML do modal
 */
function injectModalHTML() {
  if (document.getElementById('prizely-modal')) {
    return; // Já existe
  }

  // Criar overlay
  const overlay = document.createElement('div');
  overlay.id = 'prizely-modal-overlay';
  overlay.classList.add('hidden');
  document.body.appendChild(overlay);

  // Criar modal
  const modal = document.createElement('div');
  modal.id = 'prizely-modal';
  modal.classList.add('hidden');
  
  modal.innerHTML = `
    <div class="prizely-container">
      <header class="prizely-header">
        <div class="prizely-header-content">
          <h1>Exportar para CRM</h1>
          <p class="subtitle">Adicionar contato do WhatsApp ao Prizely</p>
        </div>
        <button class="prizely-close-btn" id="prizelyCloseBtn" title="Fechar">×</button>
      </header>

      <div id="infoContainer" class="info-container hidden">
        <span class="info-icon">ℹ️</span>
        <div>
          <strong>Dica:</strong> Se os campos não foram preenchidos automaticamente, 
          clique no nome do contato no topo do WhatsApp para abrir o painel de informações, 
          depois feche este modal e abra novamente.
        </div>
      </div>

      <div id="errorContainer" class="error-container hidden"></div>
      <div id="successContainer" class="success-container hidden"></div>

      <form id="clienteForm" class="prizely-form">
        <div class="form-group">
          <label for="dataContato">Data de contato *</label>
          <input type="date" id="dataContato" name="dataContato" required>
        </div>

        <div class="form-group">
          <label for="nome">Nome do cliente *</label>
          <input type="text" id="nome" name="nome" placeholder="Nome completo" required>
        </div>

        <div class="form-group">
          <label for="whatsappInstagram">WhatsApp / Instagram *</label>
          <input type="text" id="whatsappInstagram" name="whatsappInstagram" placeholder="@usuario ou telefone" required>
        </div>

        <div class="form-group">
          <label for="origem">Origem *</label>
          <select id="origem" name="origem" required>
            <option value="Indicação">Indicação</option>
            <option value="Orgânico / Perfil" selected>Orgânico / Perfil</option>
            <option value="Anúncio">Anúncio</option>
            <option value="Cliente antigo">Cliente antigo</option>
          </select>
        </div>

        <div class="form-group toggle-group">
          <label class="toggle-label">
            <div class="toggle-text">
              <span class="toggle-title">Orçamento enviado</span>
              <span class="toggle-description">Marque se o orçamento foi enviado</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="orcamentoEnviado" name="orcamentoEnviado">
              <span class="slider"></span>
            </label>
          </label>
        </div>

        <div class="form-group">
          <label for="resultado">Resultado *</label>
          <select id="resultado" name="resultado" required>
            <option value="Venda">Venda</option>
            <option value="Orçamento em Processo" selected>Orçamento em Processo</option>
            <option value="Não Venda">Não Venda</option>
          </select>
        </div>

        <div class="form-group">
          <label for="qualidadeContato">Qualidade do contato *</label>
          <select id="qualidadeContato" name="qualidadeContato" required>
            <option value="Bom">Bom</option>
            <option value="Regular" selected>Regular</option>
            <option value="Ruim">Ruim</option>
          </select>
        </div>

        <div class="form-group toggle-group">
          <label class="toggle-label">
            <div class="toggle-text">
              <span class="toggle-title">Cliente não respondeu</span>
              <span class="toggle-description">Marque se o cliente não respondeu</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="naoRespondeu" name="naoRespondeu">
              <span class="slider"></span>
            </label>
          </label>
        </div>

        <div class="form-group" id="valorFechadoGroup" style="display: none;">
          <label for="valorFechado">Valor fechado</label>
          <input type="text" id="valorFechado" name="valorFechado" placeholder="R$ 0,00">
        </div>

        <div id="pagamentoFields" style="display: none;">
          <div class="section-divider"></div>
          <h3 class="section-title">Pagamento</h3>

          <div class="form-group toggle-group">
            <label class="toggle-label">
              <div class="toggle-text">
                <span class="toggle-title">Cliente pagou sinal</span>
                <span class="toggle-description">Marque quando o cliente pagar o sinal</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="pagouSinal" name="pagouSinal">
                <span class="slider"></span>
              </label>
            </label>
          </div>

          <div class="form-group" id="valorSinalGroup" style="display: none;">
            <label for="valorSinal">Valor do sinal *</label>
            <input type="text" id="valorSinal" name="valorSinal" placeholder="R$ 0,00">
          </div>

          <div class="form-group" id="dataPagamentoSinalGroup" style="display: none;">
            <label for="dataPagamentoSinal">Data do pagamento do sinal *</label>
            <input type="date" id="dataPagamentoSinal" name="dataPagamentoSinal">
          </div>

          <div class="form-group toggle-group">
            <label class="toggle-label">
              <div class="toggle-text">
                <span class="toggle-title">Venda totalmente paga</span>
                <span class="toggle-description">Marque quando o pagamento for completo</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="vendaPaga" name="vendaPaga">
                <span class="slider"></span>
              </label>
            </label>
          </div>

          <div class="form-group" id="dataPagamentoVendaGroup" style="display: none;">
            <label for="dataPagamentoVenda">Data do pagamento completo *</label>
            <input type="date" id="dataPagamentoVenda" name="dataPagamentoVenda">
          </div>
        </div>

        <div class="form-group">
          <label for="dataLembreteChamada">Data para chamar novamente</label>
          <input type="date" id="dataLembreteChamada" name="dataLembreteChamada">
          <small class="field-hint">Configure quando ser notificado sobre este cliente</small>
        </div>

        <div class="form-group">
          <label for="observacao">Observações</label>
          <textarea id="observacao" name="observacao" rows="3" placeholder="Detalhes que ajudam no acompanhamento do cliente"></textarea>
        </div>

        <div class="form-actions">
          <button type="button" id="settingsBtn" class="btn btn-secondary">⚙️ Configurar</button>
          <button type="submit" id="submitBtn" class="btn btn-primary">
            <span id="submitText">Enviar para CRM</span>
            <span id="submitLoader" class="loader hidden"></span>
          </button>
        </div>
      </form>

      <div id="settingsModal" class="modal hidden">
        <div class="modal-content">
          <h2>Configurações</h2>
          <div class="form-group">
            <label for="crmUrl">URL do CRM *</label>
            <input type="url" id="crmUrl" placeholder="https://seu-crm.vercel.app">
            <small class="field-hint">Ex: http://localhost:3000 ou https://prizely.vercel.app</small>
          </div>
          <div class="modal-actions">
            <button type="button" id="cancelSettingsBtn" class="btn btn-secondary">Cancelar</button>
            <button type="button" id="saveSettingsBtn" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// =====================================================
// LÓGICA DO MODAL
// =====================================================

function showError(msg) {
  const el = document.getElementById('errorContainer');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
  }
}

function showSuccess(msg) {
  const el = document.getElementById('successContainer');
  if (el) {
    el.textContent = '✓ ' + msg;
    el.classList.remove('hidden');
    setTimeout(() => {
      el.classList.add('hidden');
      hideModal();
    }, 2000);
  }
}

function showInfo(show = true) {
  const el = document.getElementById('infoContainer');
  if (el) {
    if (show) {
      el.classList.remove('hidden');
      // Auto-esconder após 10 segundos
      setTimeout(() => {
        el.classList.add('hidden');
      }, 10000);
    } else {
      el.classList.add('hidden');
    }
  }
}

function hideMessages() {
  const err = document.getElementById('errorContainer');
  const succ = document.getElementById('successContainer');
  if (err) err.classList.add('hidden');
  if (succ) succ.classList.add('hidden');
}

function updateValorFechadoVisibility() {
  const orc = document.getElementById('orcamentoEnviado');
  const res = document.getElementById('resultado');
  const val = document.getElementById('valorFechadoGroup');
  if (orc && res && val) {
    val.style.display = (orc.checked || res.value === 'Venda') ? 'flex' : 'none';
  }
}

function updatePagamentoFieldsVisibility() {
  const res = document.getElementById('resultado');
  const pag = document.getElementById('pagamentoFields');
  if (res && pag) {
    pag.style.display = res.value === 'Venda' ? 'block' : 'none';
  }
}

function updateSinalFieldsVisibility() {
  const ps = document.getElementById('pagouSinal');
  const vs = document.getElementById('valorSinalGroup');
  const ds = document.getElementById('dataPagamentoSinalGroup');
  if (ps && vs && ds) {
    vs.style.display = ps.checked ? 'flex' : 'none';
    ds.style.display = ps.checked ? 'flex' : 'none';
  }
}

function updateVendaPagaFieldVisibility() {
  const vp = document.getElementById('vendaPaga');
  const dv = document.getElementById('dataPagamentoVendaGroup');
  if (vp && dv) {
    dv.style.display = vp.checked ? 'flex' : 'none';
  }
}

function setupCurrencyInput(id) {
  const input = document.getElementById(id);
  if (!input) return;
  
  input.addEventListener('input', (e) => {
    e.target.value = formatCurrency(e.target.value);
  });
  
  input.addEventListener('focus', (e) => {
    if (!e.target.value) e.target.value = 'R$ 0,00';
  });
}

async function getCrmUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['crmUrl'], (result) => {
      const url = result.crmUrl || 'http://localhost:3000';
      console.log('Prizely: URL do CRM carregada:', url);
      resolve(url);
    });
  });
}

async function sendToAPI(formData) {
  const crmUrl = await getCrmUrl();
  console.log('Prizely: Enviando dados para:', `${crmUrl}/api/clientes`);
  console.log('Prizely: Dados do formulário:', formData);
  
  try {
    const response = await fetch(`${crmUrl}/api/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData)
    });
    
    console.log('Prizely: Resposta da API:', response.status, response.statusText);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autenticado. Por favor, faça login no CRM primeiro.');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Prizely: Cliente salvo com sucesso:', result);
    return result;
  } catch (error) {
    console.error('Prizely: Erro ao enviar para API:', error);
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(`Não foi possível conectar ao CRM em ${crmUrl}. Verifique se a URL está correta e se o servidor está rodando.`);
    }
    throw error;
  }
}

function getFormData() {
  const form = document.getElementById('clienteForm');
  if (!form) return null;
  const fd = new FormData(form);
  return {
    dataContato: fd.get('dataContato'),
    nome: fd.get('nome'),
    whatsappInstagram: fd.get('whatsappInstagram'),
    origem: fd.get('origem'),
    orcamentoEnviado: document.getElementById('orcamentoEnviado')?.checked ? 'Sim' : 'Não',
    resultado: fd.get('resultado'),
    qualidadeContato: fd.get('qualidadeContato'),
    naoRespondeu: document.getElementById('naoRespondeu')?.checked || false,
    valorFechado: fd.get('valorFechado') ? parseCurrency(fd.get('valorFechado')) : '',
    observacao: fd.get('observacao') || '',
    pagouSinal: document.getElementById('pagouSinal')?.checked || false,
    valorSinal: fd.get('valorSinal') ? parseCurrency(fd.get('valorSinal')) : '',
    dataPagamentoSinal: fd.get('dataPagamentoSinal') || '',
    vendaPaga: document.getElementById('vendaPaga')?.checked || false,
    dataPagamentoVenda: fd.get('dataPagamentoVenda') || '',
    dataLembreteChamada: fd.get('dataLembreteChamada') || ''
  };
}

function validateForm() {
  const data = getFormData();
  if (!data) throw new Error('Formulário não encontrado.');
  if (!data.nome.trim()) throw new Error('Nome do cliente é obrigatório.');
  if (!data.whatsappInstagram.trim()) throw new Error('WhatsApp/Instagram é obrigatório.');
  if (!data.dataContato) throw new Error('Data de contato é obrigatória.');
  if (data.pagouSinal && !data.valorSinal) throw new Error('Valor do sinal é obrigatório quando marcado como pago.');
  if (data.pagouSinal && !data.dataPagamentoSinal) throw new Error('Data do pagamento do sinal é obrigatória.');
  if (data.vendaPaga && !data.dataPagamentoVenda) throw new Error('Data do pagamento completo é obrigatória.');
}

async function handleSubmit(e) {
  e.preventDefault();
  hideMessages();
  try {
    validateForm();
    const btn = document.getElementById('submitBtn');
    const text = document.getElementById('submitText');
    const loader = document.getElementById('submitLoader');
    if (btn) btn.disabled = true;
    if (text) text.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
    await sendToAPI(getFormData());
    showSuccess('Cliente salvo com sucesso!');
  } catch (error) {
    showError(error.message || 'Erro ao salvar cliente.');
    const btn = document.getElementById('submitBtn');
    const text = document.getElementById('submitText');
    const loader = document.getElementById('submitLoader');
    if (btn) btn.disabled = false;
    if (text) text.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
  }
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    console.log('Prizely: Abrindo modal de configurações');
    modal.classList.remove('hidden');
    chrome.storage.sync.get(['crmUrl'], (result) => {
      const input = document.getElementById('crmUrl');
      if (input) input.value = result.crmUrl || 'http://localhost:3000';
    });
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    console.log('Prizely: Fechando modal de configurações');
    modal.classList.add('hidden');
  }
}

function saveSettings() {
  const input = document.getElementById('crmUrl');
  if (!input) {
    console.error('Prizely: Campo de URL não encontrado');
    return;
  }
  const url = input.value.trim();
  if (!url) { 
    showError('Por favor, informe a URL do CRM.');
    return; 
  }
  try {
    new URL(url);
    chrome.storage.sync.set({ crmUrl: url }, () => {
      console.log('Prizely: URL do CRM salva:', url);
      
      // Fechar o modal PRIMEIRO
      closeSettingsModal();
      
      // Depois mostrar mensagem de sucesso
      setTimeout(() => {
        const successContainer = document.getElementById('successContainer');
        if (successContainer) {
          successContainer.textContent = '✓ Configurações salvas com sucesso!';
          successContainer.classList.remove('hidden');
          setTimeout(() => {
            successContainer.classList.add('hidden');
          }, 3000);
        }
      }, 100);
    });
  } catch (e) {
    console.error('Prizely: Erro ao validar URL:', e);
    showError('URL inválida. Por favor, informe uma URL válida (ex: http://localhost:3000).');
  }
}

/**
 * Preenche os campos do formulário com dados do WhatsApp
 * Usa sistema de retry inteligente com múltiplas tentativas
 */
function fillContactData(retryCount = 0) {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 500;
  
  console.log(`Prizely: Extraindo e preenchendo dados do contato (tentativa ${retryCount + 1}/${MAX_RETRIES + 1})...`);
  
  // Aguardar um pouco para garantir que o WhatsApp carregou completamente
  setTimeout(() => {
    const contactInfo = extractContactInfo();
    
    if (contactInfo && contactInfo.success) {
      const ni = document.getElementById('nome');
      const wi = document.getElementById('whatsappInstagram');
      
      if (ni && contactInfo.data.nome) {
        ni.value = contactInfo.data.nome;
        console.log('Prizely: ✅ Nome preenchido:', contactInfo.data.nome);
      } else {
        console.warn('Prizely: Campo nome não encontrado no formulário');
      }
      
      if (wi && contactInfo.data.whatsappInstagram) {
        wi.value = contactInfo.data.whatsappInstagram;
        console.log('Prizely: ✅ WhatsApp/Instagram preenchido:', contactInfo.data.whatsappInstagram);
      } else {
        console.warn('Prizely: Campo WhatsApp/Instagram não encontrado no formulário');
      }
      
      // Mostrar dica apenas se não conseguiu extrair o telefone
      const gotPhone = contactInfo.data.whatsappInstagram && 
                       contactInfo.data.whatsappInstagram !== contactInfo.data.nome &&
                       /\d{10,}/.test(contactInfo.data.whatsappInstagram);
      
      if (!gotPhone) {
        console.log('Prizely: Telefone não extraído corretamente, mostrando dica');
        showInfo(true);
      } else {
        showInfo(false);
      }
      
      console.log('Prizely: ✅ Dados do WhatsApp extraídos e preenchidos:', contactInfo.data);
    } else if (contactInfo && contactInfo.error) {
      console.warn('Prizely: ⚠️ Erro ao extrair dados:', contactInfo.error);
      
      // Se ainda temos tentativas e o erro sugere que pode funcionar com retry
      if (retryCount < MAX_RETRIES && (contactInfo.needsPanel || !contactInfo.error.includes('Nenhuma conversa ativa'))) {
        console.log(`Prizely: Tentando novamente em ${RETRY_DELAY}ms...`);
        setTimeout(() => fillContactData(retryCount + 1), RETRY_DELAY);
        return;
      }
      
      // Mostrar dica se não conseguiu extrair dados
      if (contactInfo.needsPanel) {
        showInfo(true);
      }
    } else {
      console.warn('Prizely: ⚠️ Não foi possível extrair dados do WhatsApp');
      
      // Retry se ainda temos tentativas
      if (retryCount < MAX_RETRIES) {
        console.log(`Prizely: Tentando novamente em ${RETRY_DELAY}ms...`);
        setTimeout(() => fillContactData(retryCount + 1), RETRY_DELAY);
        return;
      }
      
      showInfo(true);
    }
  }, retryCount === 0 ? 300 : RETRY_DELAY); // Primeira tentativa espera mais, retries esperam menos
}

/**
 * Inicializa a lógica do modal
 */
function initModalLogic() {
  if (window.prizelyModalInitialized) {
    console.log('Prizely: Modal já inicializado, pulando...');
    return;
  }
  window.prizelyModalInitialized = true;
  console.log('Prizely: Inicializando lógica do modal...');
  
  // Aguardar um pouco para o DOM estar pronto
  setTimeout(() => {
    console.log('Prizely: Configurando event listeners...');
    const dc = document.getElementById('dataContato');
    if (dc) dc.value = getTodayBR();
    
    setupCurrencyInput('valorFechado');
    setupCurrencyInput('valorSinal');
    
    const oc = document.getElementById('orcamentoEnviado');
    const rs = document.getElementById('resultado');
    const ps = document.getElementById('pagouSinal');
    const vp = document.getElementById('vendaPaga');
    
    if (oc) oc.addEventListener('change', updateValorFechadoVisibility);
    if (rs) {
      rs.addEventListener('change', () => {
        updateValorFechadoVisibility();
        updatePagamentoFieldsVisibility();
      });
    }
    if (ps) ps.addEventListener('change', updateSinalFieldsVisibility);
    if (vp) vp.addEventListener('change', updateVendaPagaFieldVisibility);
    
    const form = document.getElementById('clienteForm');
    if (form) form.addEventListener('submit', handleSubmit);
    
    const sb = document.getElementById('settingsBtn');
    const csb = document.getElementById('cancelSettingsBtn');
    const ssb = document.getElementById('saveSettingsBtn');
    const cb = document.getElementById('prizelyCloseBtn');
    
    if (sb) {
      sb.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSettingsModal();
      });
    }
    
    if (csb) {
      csb.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSettingsModal();
      });
    }
    
    if (ssb) {
      ssb.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveSettings();
      });
    }
    
    if (cb) {
      cb.addEventListener('click', () => {
        hideModal();
      });
    }
    
    // Fechar modal ao clicar no overlay do modal de configurações
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          e.preventDefault();
          e.stopPropagation();
          closeSettingsModal();
        }
      });
      
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    }
    
    // Campos condicionais
    updateValorFechadoVisibility();
    updatePagamentoFieldsVisibility();
    updateSinalFieldsVisibility();
    updateVendaPagaFieldVisibility();
    
    console.log('Prizely: Modal inicializado com sucesso!');
    
    // Preencher dados do contato
    setTimeout(() => fillContactData(), 150);
  }, 100);
}

/**
 * Mostra o modal
 */
function showModal() {
  console.log('Prizely: Mostrando modal...');
  const modal = document.getElementById('prizely-modal');
  const overlay = document.getElementById('prizely-modal-overlay');
  
  if (!modal) {
    console.log('Prizely: Modal não existe, criando...');
    injectModalCSS();
    injectModalHTML();
    setTimeout(() => {
      const modalAfter = document.getElementById('prizely-modal');
      const overlayAfter = document.getElementById('prizely-modal-overlay');
      if (modalAfter && overlayAfter) {
        console.log('Prizely: Modal criado, exibindo...');
        modalAfter.classList.remove('hidden');
        overlayAfter.classList.remove('hidden');
        initModalLogic();
        // Preencher dados após inicializar
        setTimeout(() => fillContactData(), 200);
      } else {
        console.error('Prizely: Erro ao criar modal - elementos não encontrados');
      }
    }, 300);
    return;
  }
  
  console.log('Prizely: Modal existe, exibindo...');
  modal.classList.remove('hidden');
  if (overlay) overlay.classList.remove('hidden');
  
  if (!window.prizelyModalInitialized) {
    initModalLogic();
  }
  
  // Sempre preencher dados quando mostrar o modal (caso o usuário tenha mudado de conversa)
  setTimeout(() => fillContactData(), 200);
}

/**
 * Esconde o modal
 */
function hideModal() {
  console.log('Prizely: Escondendo modal...');
  const modal = document.getElementById('prizely-modal');
  const overlay = document.getElementById('prizely-modal-overlay');
  
  if (modal) {
    modal.classList.add('hidden');
  }
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * Toggle do modal
 */
function toggleModal() {
  const modal = document.getElementById('prizely-modal');
  if (modal && !modal.classList.contains('hidden')) {
    hideModal();
  } else {
    showModal();
  }
}

// =====================================================
// MUTATION OBSERVER - Detecção moderna de mudanças no DOM
// =====================================================

/**
 * Observa mudanças no DOM para detectar quando o usuário muda de conversa
 * ou abre o painel de informações do contato
 */
let contactDataObserver = null;

function setupContactDataObserver() {
  if (contactDataObserver) {
    return; // Já está configurado
  }
  
  console.log('Prizely: Configurando MutationObserver para detectar mudanças no DOM...');
  
  contactDataObserver = new MutationObserver((mutations) => {
    // Verificar se o modal está aberto e precisa atualizar os dados
    const modal = document.getElementById('prizely-modal');
    if (modal && !modal.classList.contains('hidden')) {
      // Verificar se houve mudanças relevantes no header ou no drawer
      let shouldUpdate = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          // Se mudou algo no header ou no drawer, atualizar
          if (target.closest('#main header') || 
              target.closest('div[data-testid="contact-info-drawer"]') ||
              target.closest('div[data-testid="drawer-right"]')) {
            shouldUpdate = true;
            break;
          }
        }
      }
      
      if (shouldUpdate) {
        console.log('Prizely: Mudanças detectadas no DOM, atualizando dados do contato...');
        // Aguardar um pouco para o DOM estabilizar
        setTimeout(() => {
          fillContactData(0);
        }, 300);
      }
    }
  });
  
  // Observar mudanças no header e no drawer
  const header = document.querySelector('#main header, header[role="banner"]');
  const main = document.querySelector('#main');
  
  if (header) {
    contactDataObserver.observe(header, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  if (main) {
    contactDataObserver.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid']
    });
  }
  
  // Observar mudanças na URL (quando o usuário muda de conversa)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('Prizely: URL mudou, atualizando dados do contato...');
      const modal = document.getElementById('prizely-modal');
      if (modal && !modal.classList.contains('hidden')) {
        setTimeout(() => {
          fillContactData(0);
        }, 500);
      }
    }
  }, 1000);
  
  console.log('Prizely: ✅ MutationObserver configurado com sucesso');
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

// Inicializar quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectModalCSS();
    setTimeout(() => setupContactDataObserver(), 2000); // Aguardar WhatsApp carregar
  });
} else {
  injectModalCSS();
  setTimeout(() => setupContactDataObserver(), 2000); // Aguardar WhatsApp carregar
}

// Listener para mensagens do background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Prizely: Mensagem recebida:', request.action);
  
  if (request.action === 'extractContactInfo') {
    const result = extractContactInfo();
    sendResponse(result);
    return true;
  } else if (request.action === 'toggleModal' || request.action === 'toggleSidebar') {
    toggleModal();
    sendResponse({ success: true });
  } else if (request.action === 'showModal' || request.action === 'showSidebar') {
    showModal();
    sendResponse({ success: true });
  } else if (request.action === 'hideModal' || request.action === 'hideSidebar') {
    hideModal();
    sendResponse({ success: true });
  }
  return true;
});

// Expor funções globalmente
window.prizelyExtractContactInfo = extractContactInfo;

// Fechar ao clicar no overlay
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('prizely-modal-overlay');
  if (e.target === overlay) {
    hideModal();
  }
});

// Fechar com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('prizely-modal');
    if (modal && !modal.classList.contains('hidden')) {
      hideModal();
    }
  }
});
