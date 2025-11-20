// Prizely WhatsApp Exporter - Popup Logic

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
  errorContainer.textContent = message;
  errorContainer.classList.remove('hidden');
  
  setTimeout(() => {
    errorContainer.classList.add('hidden');
  }, 5000);
}

/**
 * Mostra mensagem de sucesso
 */
function showSuccess(message) {
  const successContainer = document.getElementById('successContainer');
  successContainer.textContent = '✓ ' + message;
  successContainer.classList.remove('hidden');
  
  setTimeout(() => {
    successContainer.classList.add('hidden');
    window.close(); // Fecha o popup após sucesso
  }, 2000);
}

/**
 * Esconde mensagens
 */
function hideMessages() {
  document.getElementById('errorContainer').classList.add('hidden');
  document.getElementById('successContainer').classList.add('hidden');
}

// =====================================================
// GERENCIAMENTO DE CAMPOS CONDICIONAIS
// =====================================================

/**
 * Atualiza visibilidade do campo "Valor Fechado"
 */
function updateValorFechadoVisibility() {
  const orcamentoEnviado = document.getElementById('orcamentoEnviado').checked;
  const resultado = document.getElementById('resultado').value;
  const valorFechadoGroup = document.getElementById('valorFechadoGroup');
  
  if (orcamentoEnviado || resultado === 'Venda') {
    valorFechadoGroup.style.display = 'flex';
  } else {
    valorFechadoGroup.style.display = 'none';
  }
}

/**
 * Atualiza visibilidade dos campos de pagamento
 */
function updatePagamentoFieldsVisibility() {
  const resultado = document.getElementById('resultado').value;
  const pagamentoFields = document.getElementById('pagamentoFields');
  
  if (resultado === 'Venda') {
    pagamentoFields.style.display = 'block';
  } else {
    pagamentoFields.style.display = 'none';
  }
}

/**
 * Atualiza visibilidade dos campos de sinal
 */
function updateSinalFieldsVisibility() {
  const pagouSinal = document.getElementById('pagouSinal').checked;
  const valorSinalGroup = document.getElementById('valorSinalGroup');
  const dataPagamentoSinalGroup = document.getElementById('dataPagamentoSinalGroup');
  
  if (pagouSinal) {
    valorSinalGroup.style.display = 'flex';
    dataPagamentoSinalGroup.style.display = 'flex';
  } else {
    valorSinalGroup.style.display = 'none';
    dataPagamentoSinalGroup.style.display = 'none';
  }
}

/**
 * Atualiza visibilidade do campo de data de pagamento da venda
 */
function updateVendaPagaFieldVisibility() {
  const vendaPaga = document.getElementById('vendaPaga').checked;
  const dataPagamentoVendaGroup = document.getElementById('dataPagamentoVendaGroup');
  
  if (vendaPaga) {
    dataPagamentoVendaGroup.style.display = 'flex';
  } else {
    dataPagamentoVendaGroup.style.display = 'none';
  }
}

// =====================================================
// FORMATAÇÃO DE MOEDA
// =====================================================

/**
 * Aplica máscara de moeda em um input
 */
function setupCurrencyInput(inputId) {
  const input = document.getElementById(inputId);
  
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

/**
 * Extrai informações do contato ativo no WhatsApp
 */
async function extractWhatsAppContactInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !tab.url.includes('web.whatsapp.com')) {
      showError('Por favor, abra esta extensão enquanto estiver no WhatsApp Web.');
      return null;
    }
    
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractContactInfo' }, (response) => {
        if (chrome.runtime.lastError) {
          showError('Erro ao conectar com o WhatsApp Web. Recarregue a página e tente novamente.');
          resolve(null);
          return;
        }
        
        if (!response || !response.success) {
          showError(response?.error || 'Não foi possível extrair os dados do contato.');
          resolve(null);
          return;
        }
        
        resolve(response.data);
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

/**
 * Obtém a URL do CRM configurada
 */
async function getCrmUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['crmUrl'], (result) => {
      resolve(result.crmUrl || 'http://localhost:3000');
    });
  });
}

/**
 * Envia dados do cliente para o CRM
 */
async function sendToAPI(formData) {
  const crmUrl = await getCrmUrl();
  const apiUrl = `${crmUrl}/api/clientes`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Importante: envia cookies de autenticação
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

/**
 * Obtém dados do formulário
 */
function getFormData() {
  const form = document.getElementById('clienteForm');
  const formData = new FormData(form);
  
  const data = {
    dataContato: formData.get('dataContato'),
    nome: formData.get('nome'),
    whatsappInstagram: formData.get('whatsappInstagram'),
    origem: formData.get('origem'),
    orcamentoEnviado: document.getElementById('orcamentoEnviado').checked ? 'Sim' : 'Não',
    resultado: formData.get('resultado'),
    qualidadeContato: formData.get('qualidadeContato'),
    naoRespondeu: document.getElementById('naoRespondeu').checked,
    valorFechado: formData.get('valorFechado') ? parseCurrency(formData.get('valorFechado')) : '',
    observacao: formData.get('observacao') || '',
    pagouSinal: document.getElementById('pagouSinal').checked,
    valorSinal: formData.get('valorSinal') ? parseCurrency(formData.get('valorSinal')) : '',
    dataPagamentoSinal: formData.get('dataPagamentoSinal') || '',
    vendaPaga: document.getElementById('vendaPaga').checked,
    dataPagamentoVenda: formData.get('dataPagamentoVenda') || '',
    dataLembreteChamada: formData.get('dataLembreteChamada') || '',
  };
  
  return data;
}

/**
 * Valida o formulário
 */
function validateForm() {
  const data = getFormData();
  
  // Validar campos obrigatórios
  if (!data.nome.trim()) {
    throw new Error('Nome do cliente é obrigatório.');
  }
  
  if (!data.whatsappInstagram.trim()) {
    throw new Error('WhatsApp/Instagram é obrigatório.');
  }
  
  if (!data.dataContato) {
    throw new Error('Data de contato é obrigatória.');
  }
  
  // Validações condicionais
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

/**
 * Manipula o envio do formulário
 */
async function handleSubmit(event) {
  event.preventDefault();
  
  hideMessages();
  
  try {
    // Validar formulário
    validateForm();
    
    // Mostrar loading
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitLoader = document.getElementById('submitLoader');
    
    submitBtn.disabled = true;
    submitText.classList.add('hidden');
    submitLoader.classList.remove('hidden');
    
    // Obter dados do formulário
    const formData = getFormData();
    
    // Enviar para API
    await sendToAPI(formData);
    
    // Mostrar sucesso
    showSuccess('Cliente salvo com sucesso!');
    
  } catch (error) {
    console.error('Erro ao enviar formulário:', error);
    showError(error.message || 'Erro ao salvar cliente. Tente novamente.');
    
    // Restaurar botão
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitLoader = document.getElementById('submitLoader');
    
    submitBtn.disabled = false;
    submitText.classList.remove('hidden');
    submitLoader.classList.add('hidden');
  }
}

// =====================================================
// MODAL DE CONFIGURAÇÕES
// =====================================================

/**
 * Abre o modal de configurações
 */
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('hidden');
  
  // Carregar URL atual
  chrome.storage.sync.get(['crmUrl'], (result) => {
    document.getElementById('crmUrl').value = result.crmUrl || 'http://localhost:3000';
  });
}

/**
 * Fecha o modal de configurações
 */
function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  modal.classList.add('hidden');
}

/**
 * Salva as configurações
 */
function saveSettings() {
  const crmUrl = document.getElementById('crmUrl').value.trim();
  
  if (!crmUrl) {
    alert('Por favor, informe a URL do CRM.');
    return;
  }
  
  // Validar URL
  try {
    new URL(crmUrl);
  } catch (error) {
    alert('URL inválida. Por favor, informe uma URL válida (ex: http://localhost:3000).');
    return;
  }
  
  // Salvar no storage
  chrome.storage.sync.set({ crmUrl }, () => {
    alert('Configurações salvas com sucesso!');
    closeSettingsModal();
  });
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

/**
 * Inicializa o popup
 */
async function init() {
  // Definir data de hoje
  document.getElementById('dataContato').value = getTodayBR();
  
  // Configurar formatação de moeda
  setupCurrencyInput('valorFechado');
  setupCurrencyInput('valorSinal');
  
  // Configurar event listeners para campos condicionais
  document.getElementById('orcamentoEnviado').addEventListener('change', updateValorFechadoVisibility);
  document.getElementById('resultado').addEventListener('change', () => {
    updateValorFechadoVisibility();
    updatePagamentoFieldsVisibility();
  });
  document.getElementById('pagouSinal').addEventListener('change', updateSinalFieldsVisibility);
  document.getElementById('vendaPaga').addEventListener('change', updateVendaPagaFieldVisibility);
  
  // Configurar submit do formulário
  document.getElementById('clienteForm').addEventListener('submit', handleSubmit);
  
  // Configurar botões de configurações
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  document.getElementById('cancelSettingsBtn').addEventListener('click', closeSettingsModal);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  
  // Extrair dados do WhatsApp
  const contactInfo = await extractWhatsAppContactInfo();
  if (contactInfo) {
    if (contactInfo.nome) {
      document.getElementById('nome').value = contactInfo.nome;
    }
    if (contactInfo.whatsappInstagram) {
      document.getElementById('whatsappInstagram').value = contactInfo.whatsappInstagram;
    }
  }
  
  // Inicializar visibilidade dos campos condicionais
  updateValorFechadoVisibility();
  updatePagamentoFieldsVisibility();
  updateSinalFieldsVisibility();
  updateVendaPagaFieldVisibility();
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}




