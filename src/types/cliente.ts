export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  dataContrato?: string;
  valorContrato?: number;
  status: 'ativo' | 'inativo' | 'pendente';
  observacoes?: string;
  dataCriacao: string;
  dataAtualizacao: string;
}

export interface NovoCliente extends Omit<Cliente, 'id' | 'dataCriacao' | 'dataAtualizacao'> {}