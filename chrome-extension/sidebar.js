// Prizely WhatsApp Exporter - Sidebar Logic (injetado no WhatsApp Web)

(function() {
  'use strict';

  // =====================================================
  // UTILITÁRIOS
  // =====================================================

  /**
   * Formata data para YYYY-MM-DD
   */
  function getTodayBR() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formata número para moeda brasileira
   */
  function formatCurrency(value) {
    if (!value) return '';
    
    // Remove tudo exceto números
    const numericValue = value.replace(/\D/g, '');
    
    // Converte para número e formata
    const number = parseInt(numericValue) / 100;
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(number);
  }

  /**
   * Converte string formatada para número
   */
  function parseCurrency(value) {
    if (!value) return '';
    const numericValue = value.replace(/\D/g, '');
    return (parseInt(numericValue) / 100).toFixed(2);
  }

  /**
   * Mostra mensagem de erro
   */
  function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
      errorContainer.textContent = message;
      errorContainer.classList.remove('hidden');
      
      setTimeout(() => {
        errorContainer.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * Mostra mensagem de sucesso
   */
  function showSuccess(message) {
    const successContainer = document.getElementById('successContainer');
    if (successContainer) {
      successContainer.textContent = '✓ ' + message;
      successContainer.classList.remove('hidden');
      
      setTimeout(() => {
        successContainer.classList.add('hidden');
        // Fechar sidebar após sucesso
        chrome.runtime.sendMessage({ action: 'hideSidebar' });
      }, 2000);
    }
  }

  /**
   * Esconde mensagens
   */
  function hideMessages() {
    const errorContainer = document.getElementById('errorContainer');
    const successContainer = document.getElementById('successContainer');
    if (errorContainer) errorContainer.classList.add('hidden');
    if (successContainer) successContainer.classList.add('hidden');
  }

  // =====================================================
  // GERENCIAMENTO DE CAMPOS CONDICIONAIS
  // =====================================================

  function updateValorFechadoVisibility() {
    const orcamentoEnviado = document.getElementById('orcamentoEnviado');
    const resultado = document.getElementById('resultado');
    const valorFechadoGroup = document.getElementById('valorFechadoGroup');
    
    if (orcamentoEnviado && resultado && valorFechadoGroup) {
      if (orcamentoEnviado.checked || resultado.value === 'Venda') {
        valorFechadoGroup.style.display = 'flex';
      } else {
        valorFechadoGroup.style.display = 'none';
      }
    }
  }

  function updatePagamentoFieldsVisibility() {
    const resultado = document.getElementById('resultado');
    const pagamentoFields = document.getElementById('pagamentoFields');
    
    if (resultado && pagamentoFields) {
      if (resultado.value === 'Venda') {
        pagamentoFields.style.display = 'block';
      } else {
        pagamentoFields.style.display = 'none';
      }
    }
  }

  function updateSinalFieldsVisibility() {
    const pagouSinal = document.getElementById('pagouSinal');
    const valorSinalGroup = document.getElementById('valorSinalGroup');
    const dataPagamentoSinalGroup = document.getElementById('dataPagamentoSinalGroup');
    
    if (pagouSinal && valorSinalGroup && dataPagamentoSinalGroup) {
      if (pagouSinal.checked) {
        valorSinalGroup.style.display = 'flex';
        dataPagamentoSinalGroup.style.display = 'flex';
      } else {
        valorSinalGroup.style.display = 'none';
        dataPagamentoSinalGroup.style.display = 'none';
      }
    }
  }

  function updateVendaPagaFieldVisibility() {
    const vendaPaga = document.getElementById('vendaPaga');
    const dataPagamentoVendaGroup = document.getElementById('dataPagamentoVendaGroup');
    
    if (vendaPaga && dataPagamentoVendaGroup) {
      if (vendaPaga.checked) {
        dataPagamentoVendaGroup.style.display = 'flex';
      } else {
        dataPagamentoVendaGroup.style.display = 'none';
      }
    }
  }

  // =====================================================
  // FORMATAÇÃO DE MOEDA
  // =====================================================

  function setupCurrencyInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      e.target.value = formatCurrency(value);
    });
    
    input.addEventListener('focus', (e) => {
      if (!e.target.value) {
        e.target.value = 'R$ 0,00';
      }
    });
  }

  // =====================================================
  // EXTRAÇÃO DE DADOS DO WHATSAPP
  // =====================================================

  async function extractWhatsAppContactInfo() {
    try {
      // Tentar usar função exposta pelo content script primeiro
      if (window.prizelyExtractContactInfo) {
        const result = window.prizelyExtractContactInfo();
        if (result && result.success) {
          return result.data;
        } else if (result && result.error) {
          showError(result.error);
          return null;
        }
      }
      
      // Fallback: enviar mensagem para o content script via background
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'extractContactInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Erro ao extrair dados:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            if (response && response.error) {
              showError(response.error);
            }
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Erro ao extrair dados do WhatsApp:', error);
      showError('Erro ao extrair dados do WhatsApp.');
      return null;
    }
  }

  // =====================================================
  // INTEGRAÇÃO COM API
  // =====================================================

  async function getCrmUrl() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['crmUrl'], (result) => {
        resolve(result.crmUrl || 'http://localhost:3000');
      });
    });
  }

  async function sendToAPI(formData) {
    const crmUrl = await getCrmUrl();
    const apiUrl = `${crmUrl}/api/clientes`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Não autenticado. Por favor, faça login no CRM primeiro.');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Não foi possível conectar ao CRM. Verifique se a URL está correta nas configurações.');
      }
      throw error;
    }
  }

  // =====================================================
  // MANIPULAÇÃO DO FORMULÁRIO
  // =====================================================

  function getFormData() {
    const form = document.getElementById('clienteForm');
    if (!form) return null;
    
    const formData = new FormData(form);
    
    const orcamentoEnviado = document.getElementById('orcamentoEnviado');
    const naoRespondeu = document.getElementById('naoRespondeu');
    const pagouSinal = document.getElementById('pagouSinal');
    const vendaPaga = document.getElementById('vendaPaga');
    
    const data = {
      dataContato: formData.get('dataContato'),
      nome: formData.get('nome'),
      whatsappInstagram: formData.get('whatsappInstagram'),
      origem: formData.get('origem'),
      orcamentoEnviado: orcamentoEnviado && orcamentoEnviado.checked ? 'Sim' : 'Não',
      resultado: formData.get('resultado'),
      qualidadeContato: formData.get('qualidadeContato'),
      naoRespondeu: naoRespondeu ? naoRespondeu.checked : false,
      valorFechado: formData.get('valorFechado') ? parseCurrency(formData.get('valorFechado')) : '',
      observacao: formData.get('observacao') || '',
      pagouSinal: pagouSinal ? pagouSinal.checked : false,
      valorSinal: formData.get('valorSinal') ? parseCurrency(formData.get('valorSinal')) : '',
      dataPagamentoSinal: formData.get('dataPagamentoSinal') || '',
      vendaPaga: vendaPaga ? vendaPaga.checked : false,
      dataPagamentoVenda: formData.get('dataPagamentoVenda') || '',
      dataLembreteChamada: formData.get('dataLembreteChamada') || '',
    };
    
    return data;
  }

  function validateForm() {
    const data = getFormData();
    if (!data) throw new Error('Formulário não encontrado.');
    
    if (!data.nome.trim()) {
      throw new Error('Nome do cliente é obrigatório.');
    }
    
    if (!data.whatsappInstagram.trim()) {
      throw new Error('WhatsApp/Instagram é obrigatório.');
    }
    
    if (!data.dataContato) {
      throw new Error('Data de contato é obrigatória.');
    }
    
    if (data.pagouSinal) {
      if (!data.valorSinal) {
        throw new Error('Valor do sinal é obrigatório quando marcado como pago.');
      }
      if (!data.dataPagamentoSinal) {
        throw new Error('Data do pagamento do sinal é obrigatória.');
      }
    }
    
    if (data.vendaPaga && !data.dataPagamentoVenda) {
      throw new Error('Data do pagamento completo é obrigatória.');
    }
    
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    
    hideMessages();
    
    try {
      validateForm();
      
      const submitBtn = document.getElementById('submitBtn');
      const submitText = document.getElementById('submitText');
      const submitLoader = document.getElementById('submitLoader');
      
      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.classList.add('hidden');
      if (submitLoader) submitLoader.classList.remove('hidden');
      
      const formData = getFormData();
      await sendToAPI(formData);
      
      showSuccess('Cliente salvo com sucesso!');
      
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      showError(error.message || 'Erro ao salvar cliente. Tente novamente.');
      
      const submitBtn = document.getElementById('submitBtn');
      const submitText = document.getElementById('submitText');
      const submitLoader = document.getElementById('submitLoader');
      
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.classList.remove('hidden');
      if (submitLoader) submitLoader.classList.add('hidden');
    }
  }

  // =====================================================
  // MODAL DE CONFIGURAÇÕES
  // =====================================================

  function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.remove('hidden');
      
      chrome.storage.sync.get(['crmUrl'], (result) => {
        const crmUrlInput = document.getElementById('crmUrl');
        if (crmUrlInput) {
          crmUrlInput.value = result.crmUrl || 'http://localhost:3000';
        }
      });
    }
  }

  function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('hidden');
  }

  function saveSettings() {
    const crmUrlInput = document.getElementById('crmUrl');
    if (!crmUrlInput) return;
    
    const crmUrl = crmUrlInput.value.trim();
    
    if (!crmUrl) {
      alert('Por favor, informe a URL do CRM.');
      return;
    }
    
    try {
      new URL(crmUrl);
    } catch (error) {
      alert('URL inválida. Por favor, informe uma URL válida (ex: http://localhost:3000).');
      return;
    }
    
    chrome.storage.sync.set({ crmUrl }, () => {
      alert('Configurações salvas com sucesso!');
      closeSettingsModal();
    });
  }

  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================

  async function init() {
    // Aguardar um pouco para garantir que o DOM está pronto
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dataContato = document.getElementById('dataContato');
    if (dataContato) {
      dataContato.value = getTodayBR();
    }
    
    setupCurrencyInput('valorFechado');
    setupCurrencyInput('valorSinal');
    
    const orcamentoEnviado = document.getElementById('orcamentoEnviado');
    const resultado = document.getElementById('resultado');
    const pagouSinal = document.getElementById('pagouSinal');
    const vendaPaga = document.getElementById('vendaPaga');
    
    if (orcamentoEnviado) {
      orcamentoEnviado.addEventListener('change', updateValorFechadoVisibility);
    }
    
    if (resultado) {
      resultado.addEventListener('change', () => {
        updateValorFechadoVisibility();
        updatePagamentoFieldsVisibility();
      });
    }
    
    if (pagouSinal) {
      pagouSinal.addEventListener('change', updateSinalFieldsVisibility);
    }
    
    if (vendaPaga) {
      vendaPaga.addEventListener('change', updateVendaPagaFieldVisibility);
    }
    
    const form = document.getElementById('clienteForm');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }
    
    const settingsBtn = document.getElementById('settingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const closeBtn = document.getElementById('prizelyCloseBtn');
    
    if (settingsBtn) {
      settingsBtn.addEventListener('click', openSettingsModal);
    }
    
    if (cancelSettingsBtn) {
      cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    }
    
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        // Notificar o content script para esconder a sidebar
        window.dispatchEvent(new CustomEvent('prizely-hide-sidebar'));
        // Também enviar mensagem para garantir
        chrome.runtime.sendMessage({ action: 'hideSidebar' }).catch(() => {
          // Se falhar, tentar esconder diretamente
          const sidebar = document.getElementById('prizely-sidebar');
          const overlay = document.getElementById('prizely-sidebar-overlay');
          if (sidebar) sidebar.classList.add('hidden');
          if (overlay) overlay.classList.add('hidden');
        });
      });
    }
    
    // Listener para evento de esconder sidebar
    window.addEventListener('prizely-hide-sidebar', () => {
      const sidebar = document.getElementById('prizely-sidebar');
      const overlay = document.getElementById('prizely-sidebar-overlay');
      if (sidebar) sidebar.classList.add('hidden');
      if (overlay) overlay.classList.add('hidden');
    });
    
    // Extrair dados do WhatsApp
    const contactInfo = await extractWhatsAppContactInfo();
    if (contactInfo) {
      const nomeInput = document.getElementById('nome');
      const whatsappInput = document.getElementById('whatsappInstagram');
      
      if (nomeInput && contactInfo.nome) {
        nomeInput.value = contactInfo.nome;
      }
      if (whatsappInput && contactInfo.whatsappInstagram) {
        whatsappInput.value = contactInfo.whatsappInstagram;
      }
    }
    
    updateValorFechadoVisibility();
    updatePagamentoFieldsVisibility();
    updateSinalFieldsVisibility();
    updateVendaPagaFieldVisibility();
  }

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

