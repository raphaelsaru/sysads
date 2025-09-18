'use client';

import { useState, useEffect } from 'react';
import { Cliente, NovoCliente } from '@/types/crm';
import { supabase } from '@/lib/supabase';

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      // Use Supabase client directly instead of fetch
      const { data: clientesData, error } = await supabase
        .from('clientes')
        .select(`
          id,
          data_contato,
          nome,
          whatsapp_instagram,
          origem,
          orcamento_enviado,
          resultado,
          qualidade_contato,
          valor_fechado,
          observacao,
          created_at,
          updated_at
        `)
        .order('data_contato', { ascending: false });

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        return;
      }

      // Transform to match existing interface
      const transformedClientes: Cliente[] = clientesData.map(cliente => ({
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem as Cliente['origem'],
        orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
        resultado: cliente.resultado as Cliente['resultado'],
        qualidadeContato: cliente.qualidade_contato as Cliente['qualidadeContato'],
        valorFechado: cliente.valor_fechado?.toString(),
        observacao: cliente.observacao,
      }));

      setClientes(transformedClientes);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarClientes();
  }, []);

  const adicionarCliente = async (novoCliente: NovoCliente) => {
    setLoading(true);
    try {
      // Get current user for user_id
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Insert cliente with user_id
      const { data: cliente, error } = await supabase
        .from('clientes')
        .insert({
          user_id: user.id,
          data_contato: novoCliente.dataContato,
          nome: novoCliente.nome,
          whatsapp_instagram: novoCliente.whatsappInstagram,
          origem: novoCliente.origem,
          orcamento_enviado: novoCliente.orcamentoEnviado === 'Sim',
          resultado: novoCliente.resultado,
          qualidade_contato: novoCliente.qualidadeContato,
          valor_fechado: novoCliente.valorFechado ? parseFloat(novoCliente.valorFechado) : null,
          observacao: novoCliente.observacao || null
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar cliente:', error);
        throw new Error('Erro ao criar cliente');
      }

      // Transform to match existing interface
      const transformedCliente: Cliente = {
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem as Cliente['origem'],
        orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
        resultado: cliente.resultado as Cliente['resultado'],
        qualidadeContato: cliente.qualidade_contato as Cliente['qualidadeContato'],
        valorFechado: cliente.valor_fechado?.toString(),
        observacao: cliente.observacao,
      };

      setClientes(prev => [...prev, transformedCliente]);
      return transformedCliente;
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const editarCliente = async (id: string, dadosAtualizados: Partial<NovoCliente>) => {
    setLoading(true);
    try {
      type ClienteUpdatePayload = {
        data_contato?: string;
        nome?: string;
        whatsapp_instagram?: string;
        origem?: Cliente['origem'];
        orcamento_enviado?: boolean;
        resultado?: Cliente['resultado'];
        qualidade_contato?: Cliente['qualidadeContato'];
        valor_fechado?: number | null;
        observacao?: string | null;
      };

      const updateData: ClienteUpdatePayload = {};
      if (dadosAtualizados.dataContato) updateData.data_contato = dadosAtualizados.dataContato;
      if (dadosAtualizados.nome) updateData.nome = dadosAtualizados.nome;
      if (dadosAtualizados.whatsappInstagram) updateData.whatsapp_instagram = dadosAtualizados.whatsappInstagram;
      if (dadosAtualizados.origem) updateData.origem = dadosAtualizados.origem;
      if (dadosAtualizados.orcamentoEnviado !== undefined) updateData.orcamento_enviado = dadosAtualizados.orcamentoEnviado === 'Sim';
      if (dadosAtualizados.resultado) updateData.resultado = dadosAtualizados.resultado;
      if (dadosAtualizados.qualidadeContato) updateData.qualidade_contato = dadosAtualizados.qualidadeContato;
      if (dadosAtualizados.valorFechado !== undefined) updateData.valor_fechado = dadosAtualizados.valorFechado ? parseFloat(dadosAtualizados.valorFechado) : null;
      if (dadosAtualizados.observacao !== undefined) updateData.observacao = dadosAtualizados.observacao || null;

      const { data: cliente, error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar cliente:', error);
        throw new Error('Erro ao atualizar cliente');
      }

      // Transform to match existing interface
      const transformedCliente: Cliente = {
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem as Cliente['origem'],
        orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
        resultado: cliente.resultado as Cliente['resultado'],
        qualidadeContato: cliente.qualidade_contato as Cliente['qualidadeContato'],
        valorFechado: cliente.valor_fechado?.toString(),
        observacao: cliente.observacao,
      };

      setClientes(prev =>
        prev.map(c =>
          c.id === id ? transformedCliente : c
        )
      );
      return transformedCliente;
    } catch (error) {
      console.error('Erro ao editar cliente:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const excluirCliente = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir cliente:', error);
        throw new Error('Erro ao excluir cliente');
      }

      setClientes(prev => prev.filter(cliente => cliente.id !== id));
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const buscarCliente = (id: string): Cliente | undefined => {
    return clientes.find(cliente => cliente.id === id);
  };

  // Função helper para parsing de valores monetários
  const parseValorFechado = (valorStr: string): number => {
    if (!valorStr || valorStr.trim() === '') return 0;

    // Remove R$, espaços e converte vírgula para ponto
    const valor = valorStr
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')  // Remove pontos de milhares
      .replace(',', '.');  // Converte vírgula decimal para ponto

    return parseFloat(valor) || 0;
  };

  // Estatísticas
  const estatisticas = {
    total: clientes.length,
    vendas: clientes.filter(c => c.resultado === 'Venda').length,
    emProcesso: clientes.filter(c => c.resultado === 'Orçamento em Processo').length,
    naoVenda: clientes.filter(c => c.resultado === 'Não Venda').length,
    // Valor total dos orçamentos em processo
    valorEmProcesso: clientes
      .filter(c => c.resultado === 'Orçamento em Processo' && c.valorFechado && c.valorFechado.trim() !== '')
      .reduce((acc, c) => acc + parseValorFechado(c.valorFechado!), 0),
    // Valor total das vendas efetivadas
    valorVendido: clientes
      .filter(c => c.resultado === 'Venda' && c.valorFechado && c.valorFechado.trim() !== '')
      .reduce((acc, c) => acc + parseValorFechado(c.valorFechado!), 0)
  };

  return {
    clientes,
    loading,
    adicionarCliente,
    editarCliente,
    excluirCliente,
    buscarCliente,
    estatisticas,
    carregarClientes
  };
}
