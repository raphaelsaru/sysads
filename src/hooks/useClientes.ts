'use client';

import { useState, useEffect } from 'react';
import { Cliente, NovoCliente } from '@/types/crm';

// Dados do CSV convertidos para o formato da interface
const clientesIniciais: Cliente[] = [
  {
    id: '1',
    dataContato: '01/08',
    nome: 'Gedeon',
    whatsappInstagram: 'Gedeon',
    origem: 'Indicação',
    orcamentoEnviado: 'Sim',
    resultado: 'Venda',
    qualidadeContato: 'Bom',
    valorFechado: 'R$ 1.000,00'
  },
  {
    id: '2',
    dataContato: '21/08',
    nome: 'Michelle',
    whatsappInstagram: '@mimim2367',
    origem: 'Orgânico / Pefil',
    orcamentoEnviado: 'Não',
    resultado: 'Orçamento em Processo',
    qualidadeContato: 'Regular',
    observacao: 'Não tive retorno'
  },
  {
    id: '3',
    dataContato: '22/07',
    nome: 'Poochie',
    whatsappInstagram: '@upsettapoochie',
    origem: 'Anúncio',
    orcamentoEnviado: 'Sim',
    resultado: 'Orçamento em Processo',
    qualidadeContato: 'Regular'
  },
  {
    id: '4',
    dataContato: '29/08',
    nome: 'Nancy',
    whatsappInstagram: '@nanladyo',
    origem: 'Anúncio',
    orcamentoEnviado: 'Sim',
    resultado: 'Venda',
    qualidadeContato: 'Bom',
    valorFechado: 'R$ 1.200,00',
    observacao: 'vem hoje conversar pessoalmente 10/09/25'
  },
  {
    id: '5',
    dataContato: '29/08',
    nome: 'Ashley',
    whatsappInstagram: '@ulovemehoney',
    origem: 'Cliente antigo',
    orcamentoEnviado: 'Sim',
    resultado: 'Venda',
    qualidadeContato: 'Bom',
    valorFechado: 'R$ 1.600,00'
  },
  {
    id: '6',
    dataContato: '25/08',
    nome: 'Techa',
    whatsappInstagram: '@haha666833',
    origem: 'Anúncio',
    orcamentoEnviado: 'Sim',
    resultado: 'Orçamento em Processo',
    qualidadeContato: 'Bom',
    observacao: 'Já escolheu a data estou aguardando o sinal passei $600'
  },
  {
    id: '7',
    dataContato: '05/09',
    nome: 'Antonio',
    whatsappInstagram: '@antoniocanario23',
    origem: 'Anúncio',
    orcamentoEnviado: 'Sim',
    resultado: 'Orçamento em Processo',
    qualidadeContato: 'Bom',
    observacao: 'vai vir dia 12 pra conversar pessoalmente'
  },
  {
    id: '8',
    dataContato: '08/09',
    nome: 'Gleyce',
    whatsappInstagram: '@gleyce.brito.5',
    origem: 'Anúncio',
    orcamentoEnviado: 'Sim',
    resultado: 'Não Venda',
    qualidadeContato: 'Ruim',
    observacao: 'mandei o orçamento $800 e nao me respondeu mais'
  }
];

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais);
  const [loading, setLoading] = useState(false);

  const adicionarCliente = async (novoCliente: NovoCliente) => {
    setLoading(true);
    try {
      const cliente: Cliente = {
        ...novoCliente,
        id: Date.now().toString()
      };
      setClientes(prev => [...prev, cliente]);
    } finally {
      setLoading(false);
    }
  };

  const editarCliente = async (id: string, dadosAtualizados: Partial<NovoCliente>) => {
    setLoading(true);
    try {
      setClientes(prev =>
        prev.map(cliente =>
          cliente.id === id
            ? { ...cliente, ...dadosAtualizados }
            : cliente
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const excluirCliente = async (id: string) => {
    setLoading(true);
    try {
      setClientes(prev => prev.filter(cliente => cliente.id !== id));
    } finally {
      setLoading(false);
    }
  };

  const buscarCliente = (id: string): Cliente | undefined => {
    return clientes.find(cliente => cliente.id === id);
  };

  // Estatísticas
  const estatisticas = {
    total: clientes.length,
    vendas: clientes.filter(c => c.resultado === 'Venda').length,
    emProcesso: clientes.filter(c => c.resultado === 'Orçamento em Processo').length,
    naoVenda: clientes.filter(c => c.resultado === 'Não Venda').length,
    valorTotal: clientes
      .filter(c => c.valorFechado)
      .reduce((acc, c) => {
        const valor = c.valorFechado?.replace(/[R$.,]/g, '').replace(/\s/g, '') || '0';
        return acc + parseInt(valor);
      }, 0)
  };

  return {
    clientes,
    loading,
    adicionarCliente,
    editarCliente,
    excluirCliente,
    buscarCliente,
    estatisticas
  };
}