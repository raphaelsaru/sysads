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
  'fechar', 'close', 'abrir', 'open',
  
  // Textos de UI inválidos do WhatsApp
  'default-contact-refreshed', 'default-contact', 'contact-refreshed', 'refreshed',
  'search-refreshed', 'more-refreshed', 'search-refreshedmore-refreshed'
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
  
  // Verificação adicional: rejeitar textos que contenham "default" ou "refreshed" como parte do texto
  if (lower.includes('default') || lower.includes('refreshed')) {
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
    element.closest('div[data-testid="drawer-right"]') ||
    element.closest('div[data-testid="profile-drawer"]') ||
    element.closest('[aria-label="Contact info"]') ||
    element.closest('[role="dialog"][aria-label*="info" i]')
  );
}

function getContactInfoDrawer() {
  const selectors = [
    'div[data-testid="contact-info-drawer"]',
    'div[data-testid="drawer-right"]',
    'div[data-testid="profile-drawer"]',
    '[aria-label="Contact info"]',
    '[aria-label="Contact Info"]',
    '[aria-label="Contact information"]',
    '[aria-label="Contact Information"]',
    '[role="dialog"][aria-label*="contact info" i]',
    '[role="dialog"][aria-label*="contact information" i]',
    '[role="complementary"][aria-label*="contact info" i]',
    '[data-animate-modal-popup="true"] [aria-label*="contact info" i]'
  ];

  for (const selector of selectors) {
    const drawer = document.querySelector(selector);
    if (drawer) {
      console.log('Prizely: 🔍 Drawer encontrado via seletor:', selector, 'Elementos filhos:', drawer.querySelectorAll('*').length);
      return drawer;
    }
  }

  const addButton = document.querySelector('button[aria-label="Add to contacts"], div[aria-label="Add to contacts"]');
  if (addButton) {
    const dialogParent = addButton.closest('[role="dialog"], [aria-label]');
    if (dialogParent) {
      console.log('Prizely: 🔍 Drawer encontrado via botão Add, elementos filhos:', dialogParent.querySelectorAll('*').length);
      return dialogParent;
    }
  }

  // Busca alternativa: procurar por qualquer elemento que contenha "Contact info" no título
  const allDialogs = document.querySelectorAll('[role="dialog"], [role="complementary"]');
  for (const dialog of allDialogs) {
    const ariaLabel = dialog.getAttribute('aria-label') || '';
    if (ariaLabel.toLowerCase().includes('contact info') || ariaLabel.toLowerCase().includes('contact information')) {
      console.log('Prizely: 🔍 Drawer encontrado via busca alternativa, elementos filhos:', dialog.querySelectorAll('*').length);
      return dialog;
    }
  }

  return null;
}

function extractNameFromElementList(elements) {
  for (const element of elements) {
    if (!element) continue;
    // Ignorar botões ou inputs
    if (element.closest('button') || element.closest('input') || element.closest('textarea')) {
      continue;
    }

    const text = element.textContent?.trim();
    if (!text || text.length > 120) {
      if (text && text.length > 120) {
        console.log('Prizely: 🔍 Texto muito longo ignorado:', text.substring(0, 50) + '...');
      }
      continue;
    }

    const candidate = sanitizeNameCandidate(text);
    if (!candidate) {
      console.log('Prizely: 🔍 Texto rejeitado pela sanitização:', text);
      continue;
    }

    const cleanCandidate = candidate.replace(/^~\s*/, '');
    if (!cleanCandidate) {
      console.log('Prizely: 🔍 Candidato vazio após remover ~:', candidate);
      continue;
    }

    if (!/^\+?\d[\d\s\-()]{4,}$/.test(cleanCandidate)) {
      console.log('Prizely: ✅ Nome válido encontrado em extractNameFromElementList:', cleanCandidate);
      return cleanCandidate;
    } else {
      console.log('Prizely: 🔍 Candidato parece ser um número:', cleanCandidate);
    }
  }
  return '';
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
  const drawer = getContactInfoDrawer();
  if (drawer) {
    const drawerElementCount = drawer.querySelectorAll('*').length;
    console.log('Prizely: 🔍 Drawer encontrado, buscando nome... Elementos no drawer:', drawerElementCount);
    
    // Se o drawer tem poucos elementos, pode ser que não seja o drawer completo
    // Nesse caso, vamos também buscar no elemento pai
    let searchContainer = drawer;
    if (drawerElementCount < 10) {
      const parent = drawer.parentElement;
      if (parent) {
        const parentElementCount = parent.querySelectorAll('*').length;
        console.log('Prizely: 🔍 Drawer tem poucos elementos, tentando elemento pai com', parentElementCount, 'elementos');
        if (parentElementCount > drawerElementCount) {
          searchContainer = parent;
        }
      }
    }
    
    // ESTRATÉGIA 3.0: Buscar especificamente por elementos que estão logo após o número de telefone
    // O nome geralmente aparece em um elemento próximo ao número no painel
    const phoneElements = searchContainer.querySelectorAll('span, div');
    let phoneElement = null;
    for (const el of phoneElements) {
      const text = el.textContent?.trim() || '';
      if (/\+?\d[\d\s\-()]{8,}/.test(text)) {
        phoneElement = el;
        console.log('Prizely: 🔍 Número de telefone encontrado no drawer:', text);
        break;
      }
    }
    
    if (phoneElement) {
      // Buscar elementos irmãos ou próximos ao elemento do telefone
      const phoneParent = phoneElement.parentElement;
      if (phoneParent) {
        // Buscar no mesmo container do telefone
        const siblings = Array.from(phoneParent.children);
        const phoneIndex = siblings.indexOf(phoneElement);
        
        // Verificar elementos após o telefone (geralmente o nome vem depois)
        for (let i = phoneIndex + 1; i < siblings.length && i < phoneIndex + 5; i++) {
          const sibling = siblings[i];
          if (!sibling || !sibling.textContent) continue;
          
          const text = sibling.textContent.trim();
          if (!text || text.length < 2 || text.length > 100) continue;
          
          // Verificar se contém o padrão ~Nome
          if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
            console.log('Prizely: 🔍 Nome encontrado próximo ao telefone:', text, sibling.tagName);
            const candidate = sanitizeNameCandidate(text);
            if (candidate && candidate.length > 1) {
              console.log('Prizely: ✅ Nome encontrado próximo ao telefone:', candidate);
              return candidate;
            }
          }
        }
        
        // Também buscar em elementos filhos do container do telefone
        const children = phoneParent.querySelectorAll('span, div');
        for (const child of children) {
          if (child === phoneElement) continue;
          if (!child.textContent) continue;
          
          const text = child.textContent.trim();
          if (!text || text.length < 2 || text.length > 100) continue;
          
          if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
            console.log('Prizely: 🔍 Nome encontrado em elemento filho do container do telefone:', text);
            const candidate = sanitizeNameCandidate(text);
            if (candidate && candidate.length > 1) {
              console.log('Prizely: ✅ Nome encontrado em elemento filho:', candidate);
              return candidate;
            }
          }
        }
      }
    }
    
    // ESTRATÉGIA 3.1: Buscar especificamente por elementos que começam com ~
    // Primeiro, buscar em todos os elementos do drawer
    const allDrawerElements = Array.from(searchContainer.querySelectorAll('*'));
    console.log('Prizely: 🔍 Total de elementos no container de busca:', allDrawerElements.length);
    
    for (const element of allDrawerElements) {
      if (!element || !element.textContent) continue;
      
      const text = element.textContent.trim();
      if (!text || text.length < 2 || text.length > 100) continue;
      
      // Verificar se contém o padrão ~Nome (com ou sem espaço após o ~)
      if (/^~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        console.log('Prizely: 🔍 Encontrado elemento com padrão ~Nome:', text, element.tagName, element.className);
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1) {
          console.log('Prizely: ✅ Nome encontrado via padrão com til (~):', candidate);
          return candidate;
        } else {
          console.log('Prizely: ⚠️ Candidato foi rejeitado pela sanitização:', text, '->', candidate);
        }
      }
    }
    
    // ESTRATÉGIA 3.1b: Buscar em spans com selectable-text.copyable-text que contêm o padrão
    const selectableSpans = searchContainer.querySelectorAll('span.selectable-text.copyable-text, span[class*="selectable"][class*="copyable"]');
    console.log('Prizely: 🔍 Encontrados', selectableSpans.length, 'spans com selectable-text.copyable-text');
    for (const span of selectableSpans) {
      if (!span || !span.textContent) continue;
      const text = span.textContent.trim();
      if (!text || text.length < 2 || text.length > 100) continue;
      
      // Verificar se contém o padrão ~Nome
      if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        console.log('Prizely: 🔍 Encontrado span com padrão ~Nome:', text);
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1) {
          console.log('Prizely: ✅ Nome encontrado via span selectable-text com ~:', candidate);
          return candidate;
        }
      }
      
      // Também verificar divs filhos dentro desses spans
      const childDivs = span.querySelectorAll('div');
      for (const div of childDivs) {
        if (!div || !div.textContent) continue;
        const divText = div.textContent.trim();
        if (!divText || divText.length < 2 || divText.length > 100) continue;
        
        if (/~\s*[A-Za-zÀ-ÿ]/.test(divText)) {
          console.log('Prizely: 🔍 Encontrado div filho com padrão ~Nome:', divText);
          const candidate = sanitizeNameCandidate(divText);
          if (candidate && candidate.length > 1) {
            console.log('Prizely: ✅ Nome encontrado via div dentro de span selectable-text:', candidate);
            return candidate;
          }
        }
      }
    }
    
    // ESTRATÉGIA 3.2: Buscar elementos com selectable-text que não sejam números
    const selectableTexts = searchContainer.querySelectorAll('.selectable-text.copyable-text, [class*="selectable"], [class*="copyable"], span[class*="_ao3e"]');
    console.log('Prizely: 🔍 Encontrados', selectableTexts.length, 'elementos selectable-text no container');
    for (const element of selectableTexts) {
      if (!element || !element.textContent) continue;
      const text = element.textContent.trim();
      if (!text || /^\+?\d[\d\s\-()]{8,}$/.test(text)) continue; // Pular números
      
      // Verificar se contém o padrão ~Nome
      if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1 && candidate.length < 100) {
          console.log('Prizely: ✅ Nome encontrado via selectable-text com ~ no drawer:', candidate);
          return candidate;
        }
      }
      
      // Também verificar se não é número mas parece um nome
      const candidate = sanitizeNameCandidate(text);
      if (candidate && candidate.length > 1 && candidate.length < 100) {
        // Verificar se não é um número
        if (!/^\+?\d[\d\s\-()]{4,}$/.test(candidate)) {
          console.log('Prizely: ✅ Nome encontrado via selectable-text no drawer:', candidate);
          return candidate;
        }
      }
    }
    
    // ESTRATÉGIA 3.2b: Buscar divs dentro de spans com dir="auto" e selectable-text
    const spansWithDir = searchContainer.querySelectorAll('span[dir="auto"].selectable-text.copyable-text, span[dir="auto"][class*="selectable"]');
    console.log('Prizely: 🔍 Encontrados', spansWithDir.length, 'spans com dir="auto" e selectable-text');
    for (const span of spansWithDir) {
      // Buscar divs filhos
      const childDivs = span.querySelectorAll('div');
      for (const div of childDivs) {
        if (!div || !div.textContent) continue;
        const text = div.textContent.trim();
        if (!text || text.length < 2 || text.length > 100) continue;
        
        // Verificar se contém o padrão ~Nome
        if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
          console.log('Prizely: 🔍 Encontrado div dentro de span[dir="auto"] com padrão ~Nome:', text);
          const candidate = sanitizeNameCandidate(text);
          if (candidate && candidate.length > 1) {
            console.log('Prizely: ✅ Nome encontrado via div dentro de span[dir="auto"]:', candidate);
            return candidate;
          }
        }
      }
      
      // Também verificar o texto direto do span se não for número
      const spanText = span.textContent.trim();
      if (spanText && !/^\+?\d[\d\s\-()]{8,}$/.test(spanText)) {
        if (/~\s*[A-Za-zÀ-ÿ]/.test(spanText)) {
          const candidate = sanitizeNameCandidate(spanText);
          if (candidate && candidate.length > 1) {
            console.log('Prizely: ✅ Nome encontrado via span[dir="auto"] direto:', candidate);
            return candidate;
          }
        }
      }
    }
    
    // ESTRATÉGIA 3.3: Buscar divs e spans com dir="auto" que não sejam números
    const drawerTexts = searchContainer.querySelectorAll('div[dir="auto"], span[dir="auto"], [data-testid="contact-info-title"]');
    console.log('Prizely: 🔍 Encontrados', drawerTexts.length, 'elementos com dir="auto" no container');
    const nameFromDrawer = extractNameFromElementList(drawerTexts);
    if (nameFromDrawer) {
      console.log('Prizely: ✅ Nome encontrado via painel de informações:', nameFromDrawer);
      return nameFromDrawer;
    }
    
    // ESTRATÉGIA 3.3b: Buscar divs com classes específicas que podem conter o nome
    // Baseado no HTML fornecido: div com classes x1fcty0u xhslqc4 x6prxxf x1o2sk6j
    const specificDivs = searchContainer.querySelectorAll('div[class*="xhslqc4"], div[class*="x1fcty0u"]');
    console.log('Prizely: 🔍 Encontrados', specificDivs.length, 'divs com classes específicas');
    for (const div of specificDivs) {
      if (!div || !div.textContent) continue;
      const text = div.textContent.trim();
      if (!text || text.length < 2 || text.length > 100) continue;
      
      // Verificar se contém o padrão ~Nome
      if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        console.log('Prizely: 🔍 Encontrado div com classes específicas e padrão ~Nome:', text);
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1) {
          console.log('Prizely: ✅ Nome encontrado via div com classes específicas:', candidate);
          return candidate;
        }
      }
    }

    // ESTRATÉGIA 3.4: Buscar em todos os elementos do drawer, ordenando por posição (elementos mais acima primeiro)
    const allElements = Array.from(searchContainer.querySelectorAll('span, div, h1, h2, h3, p, strong, b'));
    allElements.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.top - bRect.top;
    });
    
    console.log('Prizely: 🔍 Analisando', allElements.length, 'elementos do container ordenados por posição');
    for (const element of allElements) {
      if (!element || !element.textContent) continue;
      
      // Ignorar se está dentro de um botão ou input
      if (element.closest('button') || element.closest('input') || element.closest('textarea')) {
        continue;
      }
      
      const text = element.textContent.trim();
      if (!text || text.length < 2 || text.length > 100) continue;
      
      // Pular números de telefone
      if (/^\+?\d[\d\s\-()]{8,}$/.test(text)) continue;
      
      // Priorizar elementos que começam com ~
      if (/^~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        console.log('Prizely: 🔍 Elemento ordenado com padrão ~Nome encontrado:', text, element.tagName);
        const candidate = sanitizeNameCandidate(text);
        if (candidate && candidate.length > 1 && candidate.length < 100) {
          console.log('Prizely: ✅ Nome encontrado via busca ordenada com ~ no drawer:', candidate);
          return candidate;
        }
      }
      
      // Pular textos muito curtos que são provavelmente labels
      if (text.length < 3 && !/^[A-Za-zÀ-ÿ]{2,}$/.test(text)) continue;
      
      const candidate = sanitizeNameCandidate(text);
      if (candidate && candidate.length > 1 && candidate.length < 100) {
        // Verificar se não é um número
        if (!/^\+?\d[\d\s\-()]{4,}$/.test(candidate)) {
          console.log('Prizely: ✅ Nome encontrado via busca ordenada no drawer:', candidate, element.tagName);
          return candidate;
        }
      }
    }
    
    // ESTRATÉGIA 3.5: Busca mais agressiva - procurar por qualquer texto que contenha ~ seguido de letras
    // Esta é uma busca de último recurso que varre todo o container
    console.log('Prizely: 🔍 Busca agressiva: procurando qualquer texto com ~ no container');
    const allTextNodes = [];
    const walker = document.createTreeWalker(
      searchContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (node.textContent.trim().length > 1 && node.textContent.trim().length < 100) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        const parent = node.parentElement;
        if (parent && !parent.closest('button') && !parent.closest('input')) {
          console.log('Prizely: 🔍 Texto com ~ encontrado via TreeWalker:', text, parent.tagName, parent.className);
          const candidate = sanitizeNameCandidate(text);
          if (candidate && candidate.length > 1) {
            console.log('Prizely: ✅ Nome encontrado via TreeWalker:', candidate);
            return candidate;
          }
        }
      }
    }

    console.log('Prizely: ⚠️ Drawer encontrado mas nome não extraído após todas as estratégias');
  } else {
    console.log('Prizely: ⚠️ Drawer não encontrado');
  }
  
  // ESTRATÉGIA 3.6: Se o painel está aberto mas o drawer não tem elementos suficientes,
  // buscar em todo o documento por elementos que contenham o padrão ~Nome
  const panelOpen = isContactInfoPanelOpen();
  if (panelOpen) {
    console.log('Prizely: 🔍 Painel aberto detectado, buscando ~Nome em todo o documento...');
    
    // Buscar todos os spans e divs que contenham texto começando com ~
    const allElementsWithTilde = document.querySelectorAll('span, div, h1, h2, h3, p');
    for (const element of allElementsWithTilde) {
      if (!element || !element.textContent) continue;
      
      const text = element.textContent.trim();
      if (!text || text.length < 2 || text.length > 100) continue;
      
      // Verificar se começa com ~ seguido de letras
      if (/^~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        // Verificar se está em contexto relevante (não é um botão, input, etc)
        if (element.closest('button') || element.closest('input') || element.closest('textarea')) {
          continue;
        }
        
        // Verificar se está próximo ao número de telefone ou no painel de informações
        const isInContactContext = element.closest('#main') || 
                                   element.closest('[role="dialog"]') ||
                                   element.closest('[role="complementary"]') ||
                                   element.closest('[data-testid*="drawer"]') ||
                                   element.closest('[data-testid*="contact"]');
        
        if (isInContactContext) {
          console.log('Prizely: 🔍 Elemento com ~Nome encontrado em contexto de contato:', text, element.tagName);
          const candidate = sanitizeNameCandidate(text);
          if (candidate && candidate.length > 1) {
            console.log('Prizely: ✅ Nome encontrado via busca global com painel aberto:', candidate);
            return candidate;
          }
        }
      }
    }
    
    // Busca mais específica: procurar por spans com selectable-text.copyable-text em todo o documento
    const allSelectableTexts = document.querySelectorAll('span.selectable-text.copyable-text, span[class*="selectable"][class*="copyable"]');
    console.log('Prizely: 🔍 Encontrados', allSelectableTexts.length, 'elementos selectable-text em todo o documento');
    for (const element of allSelectableTexts) {
      if (!element || !element.textContent) continue;
      
      const text = element.textContent.trim();
      if (!text || text.length < 2 || text.length > 100) continue;
      
      // Pular números
      if (/^\+?\d[\d\s\-()]{8,}$/.test(text)) continue;
      
      // Verificar se contém o padrão ~Nome
      if (/~\s*[A-Za-zÀ-ÿ]/.test(text)) {
        // Verificar se está em contexto relevante
        const isInContactContext = element.closest('#main') || 
                                   element.closest('[role="dialog"]') ||
                                   element.closest('[role="complementary"]');
        
        if (isInContactContext) {
          console.log('Prizely: 🔍 selectable-text com ~Nome encontrado:', text);
          const candidate = sanitizeNameCandidate(text);
          if (candidate && candidate.length > 1) {
            console.log('Prizely: ✅ Nome encontrado via selectable-text global:', candidate);
            return candidate;
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
    const headerName = extractNameFromElementList(textElements);
    if (headerName) {
      console.log('Prizely: ✅ Nome encontrado via análise do header:', headerName);
      return headerName;
    }
  }

  const contactContext = document.querySelectorAll('#main header, header[role="banner"], div[data-testid="conversation-panel"]');
  for (const contextElement of contactContext) {
    const genericElements = contextElement.querySelectorAll('span, div, h1, h2, h3, p');
    const genericName = extractNameFromElementList(genericElements);
    if (genericName) {
      console.log('Prizely: ✅ Nome encontrado via fallback genérico no contexto do contato:', genericName);
      return genericName;
    }
  }
  
  console.warn('Prizely: ⚠️ Não foi possível extrair o nome do contato');
  return '';
}

function normalizePhoneDigits(rawValue) {
  if (!rawValue) return '';
  let digits = String(rawValue).replace(/\D/g, '');
  if (!digits) return '';

  // Remover prefixos internacionais comuns (ex: 00)
  digits = digits.replace(/^0+/, '');

  // Remover DDI brasileiro caso presente
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.substring(2);
  }

  // Remover zeros à esquerda restantes após retirar o DDI
  digits = digits.replace(/^0+/, '');

  // Garantir que mantenhamos apenas os últimos 11 dígitos se ainda houver ruído
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }

  // Após normalização precisamos pelo menos do DDD + número (10 ou 11 dígitos)
  if (digits.length < 10) {
    return '';
  }

  return digits;
}

function extractDigitsFromCandidate(value) {
  return normalizePhoneDigits(value);
}

function extractDigitsFromText(text, strict = false) {
  if (!text) return '';
  const pattern = strict ? /^(\+?\d[\d\s\-()]{8,})$/ : /(\+?\d[\d\s\-()]{8,})/;
  const match = text.match(pattern);
  if (!match) return '';
  return extractDigitsFromCandidate(match[0]);
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
    const normalized = extractDigitsFromCandidate(storeData.phone);
    if (normalized) {
      console.log('Prizely: ✅ Telefone encontrado via WhatsApp Store (DDD + número):', normalized);
      return normalized;
    }
  }
  
  // ESTRATÉGIA 2: Extrair da URL (muito confiável)
  const urlMatch = window.location.href.match(/\/chat\/(\d+)/) || window.location.href.match(/\/(\d{10,})$/);
  if (urlMatch && urlMatch[1]) {
    const normalizedFromUrl = extractDigitsFromCandidate(urlMatch[1]);
    if (normalizedFromUrl) {
      console.log('Prizely: ✅ Telefone encontrado via URL (DDD + número):', normalizedFromUrl);
      return normalizedFromUrl;
    }
  }
  
  // ESTRATÉGIA 3: Buscar no painel de informações (quando aberto)
  const drawer = getContactInfoDrawer();
  if (drawer) {
    const phoneElements = drawer.querySelectorAll('span.selectable-text.copyable-text[dir="auto"], div.selectable-text.copyable-text[dir="auto"]');
    for (const element of phoneElements) {
      const text = element.textContent?.trim();
      const normalizedFromDrawer = extractDigitsFromText(text);
      if (normalizedFromDrawer) {
        console.log('Prizely: ✅ Telefone encontrado via painel de informações (DDD + número):', normalizedFromDrawer);
        return normalizedFromDrawer;
      }
    }
    
    const phoneNumberElement = drawer.querySelector('div[data-testid="phone-number"]');
    if (phoneNumberElement) {
      const normalizedFromDataTestId = extractDigitsFromText(phoneNumberElement.textContent?.trim());
      if (normalizedFromDataTestId) {
        console.log('Prizely: ✅ Telefone encontrado via data-testid="phone-number" (DDD + número):', normalizedFromDataTestId);
        return normalizedFromDataTestId;
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
        const normalizedFromHeader = extractDigitsFromText(value);
        if (normalizedFromHeader) {
          console.log('Prizely: ✅ Telefone encontrado via header (DDD + número):', normalizedFromHeader);
          return normalizedFromHeader;
        }
      }
    }
  }
  
  // ESTRATÉGIA 5: Buscar em elementos relevantes do documento
  const allSelectableTexts = document.querySelectorAll('span.selectable-text.copyable-text[dir="auto"]');
  let fallbackPhoneCandidate = '';
  const drawerElement = getContactInfoDrawer();
  for (const element of allSelectableTexts) {
    const text = element.textContent?.trim();
    const normalizedFromSelectable = extractDigitsFromText(text, true);
    if (normalizedFromSelectable) {
      const inHeader = element.closest('#main header');
      const inDrawer = drawerElement ? drawerElement.contains(element) : false;
      const isToolbar = element.closest('[data-testid="conversation-header"]');
      if (inHeader || inDrawer || isToolbar) {
        console.log('Prizely: ✅ Telefone encontrado via selectable-text (DDD + número):', normalizedFromSelectable);
        return normalizedFromSelectable;
      }
      if (!fallbackPhoneCandidate) {
        fallbackPhoneCandidate = normalizedFromSelectable;
      }
    }
  }

  if (fallbackPhoneCandidate) {
    console.log('Prizely: ✅ Telefone encontrado via fallback global (DDD + número):', fallbackPhoneCandidate);
    return fallbackPhoneCandidate;
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
          const numericChars = candidate.replace(/\D/g, '');
          if (numericChars.length >= 10 || candidate.length > 1) {
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
  return !!getContactInfoDrawer();
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

  const data = {
    nome: name || '',
    whatsappInstagram: phone || ''
  };

  if (data.nome || data.whatsappInstagram) {
    return {
      success: true,
      data,
      panelOpen
    };
  }

  // Se não conseguiu extrair nome, verificar se há conversa ativa
  if (!conversationActive) {
    console.warn('Prizely: Nenhuma conversa ativa e não foi possível extrair dados');
    return {
      success: false,
      error: 'Nenhuma conversa ativa. Por favor, abra uma conversa no WhatsApp Web.',
      needsPanel: false
    };
  }

  // Há conversa mas não conseguiu extrair nome
  return {
    success: false,
    error: 'Não foi possível extrair os dados do contato. Clique no nome do contato para abrir o painel e tente novamente.',
    needsPanel: !panelOpen
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
  // Normalizar URL: remover barra final se existir e garantir uma única barra antes de /api
  const normalizedUrl = crmUrl.replace(/\/+$/, '') + '/api/clientes';
  console.log('Prizely: Enviando dados para:', normalizedUrl);
  console.log('Prizely: Dados do formulário:', formData);
  
  try {
    const response = await fetch(normalizedUrl, {
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
      
      if (ni) {
        ni.value = contactInfo.data.nome || '';
        if (contactInfo.data.nome) {
          console.log('Prizely: ✅ Nome preenchido:', contactInfo.data.nome);
        } else {
          console.log('Prizely: ⚠️ Nome não identificado, campo mantido em branco');
        }
      } else {
        console.warn('Prizely: Campo nome não encontrado no formulário');
      }
      
      if (wi) {
        wi.value = contactInfo.data.whatsappInstagram || '';
        if (contactInfo.data.whatsappInstagram) {
          console.log('Prizely: ✅ WhatsApp/Instagram preenchido:', contactInfo.data.whatsappInstagram);
        } else {
          console.log('Prizely: ⚠️ Telefone não identificado, campo mantido em branco');
        }
      } else {
        console.warn('Prizely: Campo WhatsApp/Instagram não encontrado no formulário');
      }
      
      // Mostrar dica apenas se não conseguiu extrair o telefone
      const gotPhone = /\d{10,}/.test(contactInfo.data.whatsappInstagram || '');
      
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
