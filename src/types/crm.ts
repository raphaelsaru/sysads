// =====================================================
// TIPOS DE USUÁRIO E ROLES
// =====================================================

export type UserRole = 'admin' | 'user'

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string | null
  company_name?: string | null
  currency?: 'BRL' | 'USD' | 'EUR' | null
  avatar_url?: string | null
  phone?: string | null
  preferences?: Record<string, any>
  created_at: string
  updated_at: string
  last_seen_at?: string | null
}

// =====================================================
// TIPOS DE CLIENTES (CRM)
// =====================================================

export interface Cliente {
  id?: string;
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: 'Indicação' | 'Orgânico / Perfil' | 'Anúncio' | 'Cliente antigo' | 'Site';
  orcamentoEnviado: 'Sim' | 'Não';
  resultado: 'Venda' | 'Orçamento em Processo' | 'Não Venda';
  qualidadeContato: 'Bom' | 'Regular' | 'Ruim';
  naoRespondeu?: boolean;
  valorFechado?: string;
  valorFechadoNumero?: number | null;
  observacao?: string;
  createdAt?: string;
  // Campos de pagamento
  pagouSinal?: boolean;
  valorSinal?: string;
  valorSinalNumero?: number | null;
  dataPagamentoSinal?: string;
  vendaPaga?: boolean;
  dataPagamentoVenda?: string;
  // Campo de notificação
  dataLembreteChamada?: string;
  created_by?: string;
  updated_by?: string;
  totalFollowUps?: number;
  categoria?: string;
}

export interface NovoCliente {
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: Cliente['origem'];
  orcamentoEnviado: Cliente['orcamentoEnviado'];
  resultado: Cliente['resultado'];
  qualidadeContato: Cliente['qualidadeContato'];
  naoRespondeu?: boolean;
  valorFechado?: string;
  observacao?: string;
  // Campos de pagamento
  pagouSinal?: boolean;
  valorSinal?: string;
  dataPagamentoSinal?: string;
  vendaPaga?: boolean;
  dataPagamentoVenda?: string;
  // Campo de notificação
  dataLembreteChamada?: string;
  categoria?: string;
}

// =====================================================
// TIPOS DE OCR INSTAGRAM
// =====================================================

export interface OCRDetectedUser {
  username: string // @username ou nome extraído
  confidence: number // Confiança do OCR (0-1)
  isDuplicate: boolean // Se já existe no CRM
  existingClientId?: string // ID do cliente existente (se duplicado)
}

export interface OCRResult {
  users: OCRDetectedUser[]
  rawText: string // Texto bruto extraído
  processedAt: string
}

export interface BatchImportRequest {
  users: string[] // Lista de usernames/arrobas para importar
}

export interface BatchImportResult {
  created: Cliente[]
  skipped: Array<{ username: string; reason: string }>
  total: number
  success: number
  failed: number
}

// =====================================================
// TIPOS DE FOLLOW-UPS
// =====================================================

export interface FollowUp {
  id: string
  clienteId: string
  observacao: string
  respondeu: boolean
  numeroFollowup: number
  createdAt: string
  createdBy: string
}

export interface NovoFollowUp {
  clienteId: string
  observacao: string
  respondeu: boolean
}
