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
