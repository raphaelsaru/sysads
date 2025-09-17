import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { Cliente } from '@/types/crm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch cliente - RLS will automatically filter by user_id
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
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
      valorFechado: cliente.valor_fechado?.toString(),
      observacao: cliente.observacao,
    };

    return NextResponse.json(transformedCliente);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dadosAtualizados: Partial<Cliente> = await request.json();
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prepare update data
    const updateData: Record<string, string | number | boolean> = {};
    if (dadosAtualizados.dataContato) updateData.data_contato = dadosAtualizados.dataContato;
    if (dadosAtualizados.nome) updateData.nome = dadosAtualizados.nome;
    if (dadosAtualizados.whatsappInstagram) updateData.whatsapp_instagram = dadosAtualizados.whatsappInstagram;
    if (dadosAtualizados.origem) updateData.origem = dadosAtualizados.origem;
    if (dadosAtualizados.orcamentoEnviado) updateData.orcamento_enviado = dadosAtualizados.orcamentoEnviado === 'Sim';
    if (dadosAtualizados.resultado) updateData.resultado = dadosAtualizados.resultado;
    if (dadosAtualizados.qualidadeContato) updateData.qualidade_contato = dadosAtualizados.qualidadeContato;
    if (dadosAtualizados.valorFechado) updateData.valor_fechado = parseFloat(dadosAtualizados.valorFechado);
    if (dadosAtualizados.observacao !== undefined) updateData.observacao = dadosAtualizados.observacao;

    // Update cliente - RLS will automatically filter by user_id
    const { data: cliente, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
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
      valorFechado: cliente.valor_fechado?.toString(),
      observacao: cliente.observacao,
    };

    return NextResponse.json(transformedCliente);
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete cliente - RLS will automatically filter by user_id
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}