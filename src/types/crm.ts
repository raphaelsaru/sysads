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

// origem: enum Postgres `origem_tipo` (valores confirmados via live DB em
// 2026-09-02 — não é mais um palpite, é a lista real do enum).
export interface Cliente {
  id?: string;
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: 'Indicação' | 'Orgânico / Perfil' | 'Anúncio' | 'Cliente antigo' | 'Anúncio Promoção' | 'Anúncio Geral' | 'Instagram' | 'Google' | 'Outro' | 'WhatsApp' | 'Site';
  observacao?: string;
  createdAt?: string;
  createdBy?: string;
  updatedBy?: string;
  categoria?: string;
  userId?: string;
  // agregados calculados na leitura (join com negociacoes), não colunas de clientes
  totalFollowUps?: number;
  negociacoes?: Negociacao[];
  ltv?: number;
  ultimaNegociacao?: Negociacao;
}

// resultado/qualidadeContato são colunas `text` no banco (não enum Postgres),
// os unions abaixo são convenção da aplicação.
export interface Negociacao {
  id: string;
  clienteId: string;
  dataContato: string;
  orcamentoEnviado: boolean;
  resultado: 'Venda' | 'Orçamento em Processo' | 'Não Venda';
  // nullable no banco (sem NOT NULL em qualidade_contato)
  qualidadeContato?: 'Bom' | 'Regular' | 'Ruim';
  naoRespondeu?: boolean;
  valorFechado?: string;
  valorFechadoNumero?: number | null;
  observacao?: string;
  pagouSinal?: boolean;
  valorSinal?: string;
  valorSinalNumero?: number | null;
  dataPagamentoSinal?: string;
  vendaPaga?: boolean;
  dataPagamentoVenda?: string;
  dataLembreteChamada?: string;
  // coluna gerada (`data_mes_venda`, stored, read-only) — coalesce(data_pagamento_sinal, data_contato).
  // exposta como opcional pra leitura (ex.: dashboard/Fase 7); nunca setável, por isso ausente de NovaNegociacao.
  dataMesVenda?: string;
  createdAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface NovoCliente {
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: Cliente['origem'];
  observacao?: string;
  categoria?: string;
}

export interface NovaNegociacao {
  clienteId: string;
  dataContato: string;
  orcamentoEnviado: Negociacao['orcamentoEnviado'];
  resultado: Negociacao['resultado'];
  qualidadeContato?: Negociacao['qualidadeContato'];
  naoRespondeu?: boolean;
  valorFechado?: string;
  observacao?: string;
  pagouSinal?: boolean;
  valorSinal?: string;
  dataPagamentoSinal?: string;
  vendaPaga?: boolean;
  dataPagamentoVenda?: string;
  dataLembreteChamada?: string;
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
  // Usernames cujo cliente foi criado com sucesso mas cuja negociação
  // inicial falhou ao ser inserida — ainda contam em `success`/`created`
  // (a pessoa existe e está visível/editável no CRM), mas ficam sem
  // negociação inicial e precisam de atenção manual. Subconjunto de
  // `created`, não um terceiro balde.
  negociacaoFailed: string[]
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
