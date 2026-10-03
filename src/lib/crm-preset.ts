// Opções dos formulários por empresa (`tenants.crm_preset`). null = padrão Prizely.
// 'planilha' = empresas vindas de CRM em planilha (DNA4, Concept Studio, Travizan):
// campos extras (procedimento, motivo de não venda, forma de pgto do sinal).
// Design: docs/plans/2026-10-03-crm-preset-planilha-design.md
import type { Cliente, Negociacao } from '@/types/crm'

export type CrmPreset = 'planilha'

export interface OpcoesCrm {
  origens: Cliente['origem'][]
  resultados: Negociacao['resultado'][]
  qualidades: NonNullable<Negociacao['qualidadeContato']>[]
  // vazias = campo não aparece
  procedimentos: string[]
  motivosNaoVenda: string[]
  formasPagamentoSinal: string[]
}

const PADRAO: OpcoesCrm = {
  origens: ['Indicação', 'Orgânico / Perfil', 'Anúncio', 'Cliente antigo', 'Site', 'Instagram'],
  resultados: ['Venda', 'Orçamento em Processo', 'Não Venda'],
  qualidades: ['Bom', 'Regular', 'Ruim'],
  procedimentos: [],
  motivosNaoVenda: [],
  formasPagamentoSinal: [],
}

const PLANILHA: OpcoesCrm = {
  origens: [
    'Orgânico / Perfil', 'Anúncio', 'Indicação', 'Cliente antigo', 'Cliente ativo',
    'WhatsApp Studio', 'Google', 'Site', 'TikTok', 'Cliente de Porta',
  ],
  resultados: ['Venda', 'Não Venda', 'Formulário', 'Consulta Presencial', 'Orçamento em Processo', 'Cancelado'],
  qualidades: ['Bom', 'Regular', 'Ruim'],
  procedimentos: [
    'Realismo Colorido', 'Realismo Preto e Cinza', 'Cobertura', 'Reforma', 'Comics', 'Full Colors',
    'Aguardando confirmação do cliente', 'Oriental', 'Curso', 'NeoTrad', 'BlackWork', 'Projeto',
    'Fine line', 'New School', 'Comercial', 'Aquarela',
  ],
  motivosNaoVenda: [
    'Sem dinheiro', 'Sem retorno', 'Esperando cartão virar', 'Vai analisar a proposta', 'Aguardando Sinal',
    'Aguardando Retorno', 'Chamou por curiosidade', 'Artista Não Faz o Estilo', 'Cliente Desinteressado',
    'Fez em outro studio', 'Mora longe', 'Menor de idade', 'Achou Caro', 'Finais de Semana Indisponíveis',
    'Sessões de Lazer', 'Analfabeto', 'Workshop',
  ],
  formasPagamentoSinal: ['Cartão de Crédito', 'Pix', 'Boleto', 'Dinheiro', 'PagSeguro', 'Cartão de Débito', 'Transferência'],
}

export function opcoesCrm(preset?: string | null): OpcoesCrm {
  return preset === 'planilha' ? PLANILHA : PADRAO
}

// Todos os resultados possíveis (filtros/badges mostram valores de qualquer preset).
export const RESULTADOS_EM_PROCESSO: readonly string[] = ['Orçamento em Processo', 'Formulário', 'Consulta Presencial']
export const RESULTADOS_PERDA: readonly string[] = ['Não Venda', 'Cancelado']

export const RESULTADO_VARIANT: Record<Negociacao['resultado'], 'success' | 'warning' | 'destructive'> = {
  Venda: 'success',
  'Orçamento em Processo': 'warning',
  Formulário: 'warning',
  'Consulta Presencial': 'warning',
  'Não Venda': 'destructive',
  Cancelado: 'destructive',
}

/** Mantém o valor atual na lista mesmo se não pertence ao preset (ex.: lead antigo). */
export function comValorAtual<T extends string>(opcoes: readonly T[], atual?: T | null): T[] {
  return atual && !opcoes.includes(atual) ? [...opcoes, atual] : [...opcoes]
}
