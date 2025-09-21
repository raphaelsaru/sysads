export interface Cliente {
  id?: string;
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: 'Indicação' | 'Orgânico / Pefil' | 'Anúncio' | 'Cliente antigo';
  orcamentoEnviado: 'Sim' | 'Não';
  resultado: 'Venda' | 'Orçamento em Processo' | 'Não Venda';
  qualidadeContato: 'Bom' | 'Regular' | 'Ruim';
  valorFechado?: string;
  valorFechadoNumero?: number | null;
  observacao?: string;
}

export interface NovoCliente {
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: Cliente['origem'];
  orcamentoEnviado: Cliente['orcamentoEnviado'];
  resultado: Cliente['resultado'];
  qualidadeContato: Cliente['qualidadeContato'];
  valorFechado?: string;
  observacao?: string;
}
