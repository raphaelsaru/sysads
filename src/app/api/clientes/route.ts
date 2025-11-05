import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { Cliente, NovoCliente } from '@/types/crm';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch clientes - RLS will automatically filter by tenant_id
    // Users will only see clientes from their tenant
    const { data: clientes, error } = await supabase
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
        nao_respondeu,
        valor_fechado,
        observacao,
        created_at,
        updated_at,
        pagou_sinal,
        valor_sinal,
        data_pagamento_sinal,
        venda_paga,
        data_pagamento_venda,
        data_lembrete_chamada
      `)
      .order('data_contato', { ascending: false });

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // Transform to match existing interface
    const transformedClientes: Cliente[] = clientes.map(cliente => ({
      id: cliente.id,
      dataContato: cliente.data_contato,
      nome: cliente.nome,
      whatsappInstagram: cliente.whatsapp_instagram,
      origem: cliente.origem as Cliente['origem'],
      orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
      resultado: cliente.resultado as Cliente['resultado'],
      qualidadeContato: cliente.qualidade_contato as Cliente['qualidadeContato'],
      naoRespondeu: cliente.nao_respondeu || false,
      valorFechado: cliente.valor_fechado?.toString(),
      observacao: cliente.observacao,
      pagouSinal: cliente.pagou_sinal || false,
      valorSinal: cliente.valor_sinal?.toString(),
      dataPagamentoSinal: cliente.data_pagamento_sinal,
      vendaPaga: cliente.venda_paga || false,
      dataPagamentoVenda: cliente.data_pagamento_venda,
      dataLembreteChamada: cliente.data_lembrete_chamada,
    }));

    return NextResponse.json(transformedClientes);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const novoCliente: NovoCliente = await request.json();
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Insert cliente with user_id
    // tenant_id will be auto-populated by trigger
    // created_by will be set to current user
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
        nao_respondeu: novoCliente.naoRespondeu || false,
        valor_fechado: novoCliente.valorFechado ? parseFloat(novoCliente.valorFechado) : null,
        observacao: novoCliente.observacao || null,
        pagou_sinal: novoCliente.pagouSinal || false,
        valor_sinal: novoCliente.valorSinal ? parseFloat(novoCliente.valorSinal) : null,
        data_pagamento_sinal: novoCliente.dataPagamentoSinal || null,
        venda_paga: novoCliente.vendaPaga || false,
        data_pagamento_venda: novoCliente.dataPagamentoVenda || null,
        data_lembrete_chamada: novoCliente.dataLembreteChamada || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cliente:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
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
      naoRespondeu: cliente.nao_respondeu || false,
      valorFechado: cliente.valor_fechado?.toString(),
      observacao: cliente.observacao,
      pagouSinal: cliente.pagou_sinal || false,
      valorSinal: cliente.valor_sinal?.toString(),
      dataPagamentoSinal: cliente.data_pagamento_sinal,
      vendaPaga: cliente.venda_paga || false,
      dataPagamentoVenda: cliente.data_pagamento_venda,
      dataLembreteChamada: cliente.data_lembrete_chamada,
    };

    return NextResponse.json(transformedCliente, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}