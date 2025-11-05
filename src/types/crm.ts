// =====================================================
// TIPOS DE USUÁRIO E ROLES
// =====================================================

export type UserRole = 'admin_global' | 'tenant_admin' | 'tenant_user'

export interface UserProfile {
  id: string
  tenant_id: string | null
  role: UserRole
  full_name: string | null
  avatar_url?: string | null
  phone?: string | null
  preferences?: Record<string, any>
  created_at: string
  updated_at: string
  last_seen_at?: string | null
}

// =====================================================
// TIPOS DE TENANT (MULTITENANT)
// =====================================================

export interface TenantBranding {
  logo: string | null
  companyName: string | null
  primaryColor: string
  secondaryColor: string
}

export interface TenantSettings {
  [key: string]: any
}

export interface TenantMetadata {
  isDefault?: boolean
  [key: string]: any
}

export interface Tenant {
  id: string
  name: string
  slug: string
  description?: string | null
  max_clients: number
  max_users: number
  is_active: boolean
  branding: TenantBranding
  settings: TenantSettings
  metadata: TenantMetadata
  onboarding_completed?: boolean
  onboarding_completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface TenantStatistics extends Tenant {
  total_users: number
  total_clients: number
  remaining_client_slots: number
}

export interface CreateTenantInput {
  name: string
  slug: string
  description?: string
  max_clients?: number
  max_users?: number
  branding?: Partial<TenantBranding>
}

export interface UpdateTenantInput {
  name?: string
  description?: string
  max_clients?: number
  max_users?: number
  is_active?: boolean
  branding?: Partial<TenantBranding>
  settings?: Partial<TenantSettings>
}

// =====================================================
// TIPOS DE ONBOARDING
// =====================================================

export interface OnboardingData {
  companyName: string
  primaryColor: string
  secondaryColor: string
  logo?: string | null
  adminEmail?: string
  adminPassword?: string
}

export interface OnboardingStatus {
  completed: boolean
  completed_at?: string | null
  current_step?: number
}

// =====================================================
// TIPOS DE CLIENTES (CRM)
// =====================================================

export interface Cliente {
  id?: string;
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: 'Indicação' | 'Orgânico / Perfil' | 'Anúncio' | 'Cliente antigo';
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
  // Campos multitenant
  tenant_id?: string;
  created_by?: string;
  updated_by?: string;
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
}
