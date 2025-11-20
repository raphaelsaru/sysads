// Background Service Worker para a extensão Prizely WhatsApp Exporter

// Listener para instalação da extensão
chrome.runtime.onInstalled.addListener(() => {
  console.log('Prizely WhatsApp Exporter instalado com sucesso!');
  
  // Definir configurações padrão
  chrome.storage.sync.get(['crmUrl'], (result) => {
    if (!result.crmUrl) {
      chrome.storage.sync.set({ 
        crmUrl: 'http://localhost:3000' 
      });
    }
  });
});

// Listener para cliques no ícone da extensão
chrome.action.onClicked.addListener((tab) => {
  // Verificar se está no WhatsApp Web
  if (tab.url && tab.url.includes('web.whatsapp.com')) {
    // Enviar mensagem para o content script para toggle do modal
    chrome.tabs.sendMessage(tab.id, { action: 'toggleModal' }).catch((error) => {
      // Se o content script não estiver carregado, tentar injetar primeiro
      console.log('Content script não encontrado, tentando injetar...', error);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).then(() => {
        // Aguardar um pouco e tentar novamente
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'toggleModal' }).catch((err) => {
            console.error('Erro ao enviar mensagem:', err);
          });
        }, 100);
      }).catch((err) => {
        console.error('Erro ao injetar content script:', err);
      });
    });
  }
});

// Listener para comandos de teclado
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-modal') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('web.whatsapp.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleModal' }).catch((error) => {
          console.log('Content script não encontrado, tentando injetar...', error);
          // Se o content script não estiver carregado, tentar injetar primeiro
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleModal' }).catch((err) => {
                console.error('Erro ao enviar mensagem:', err);
              });
            }, 100);
          }).catch((err) => {
            console.error('Erro ao injetar content script:', err);
          });
        });
      }
    });
  }
});

// Listener para mensagens do content script ou popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getContactInfo') {
    // Reencaminhar para content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'extractContactInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Erro ao obter contato:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      }
    });
    return true; // Mantém o canal aberto para resposta assíncrona
  } else if (request.action === 'hideModal' || request.action === 'hideSidebar') {
    // Esconder modal (mantemos hideSidebar para compatibilidade)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('web.whatsapp.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'hideModal' }).catch((error) => {
          console.error('Erro ao esconder modal:', error);
        });
      }
    });
    sendResponse({ success: true });
  } else if (request.action === 'extractContactInfo') {
    // Esta mensagem vem do modal através do content.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'extractContactInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Erro ao extrair contato:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      }
    });
    return true;
  }
});
