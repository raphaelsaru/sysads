export interface Cliente {
  id?: string
  dataContato: string
  nome: string
  whatsappInstagram: string
  origem: 'Indicação' | 'Orgânico / Perfil' | 'Anúncio' | 'Cliente antigo'
  orcamentoEnviado: 'Sim' | 'Não'
  resultado: 'Venda' | 'Orçamento em Processo' | 'Não Venda'
  qualidadeContato: 'Bom' | 'Regular' | 'Ruim'
  valorFechado?: string
  valorFechadoNumero?: number | null
  observacao?: string
  createdAt?: string
}

export interface NovoCliente {
  dataContato: string
  nome: string
  whatsappInstagram: string
  origem: Cliente['origem']
  orcamentoEnviado: Cliente['orcamentoEnviado']
  resultado: Cliente['resultado']
  qualidadeContato: Cliente['qualidadeContato']
  valorFechado?: string
  observacao?: string
}

export interface ClienteEstatisticas {
  total: number
  vendas: number
  emProcesso: number
  naoVenda: number
  valorEmProcesso: number
  valorVendido: number
}
