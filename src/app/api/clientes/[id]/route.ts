import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { Cliente, Negociacao } from '@/types/crm';
import { calcularLtv } from '@/lib/negociacoes';

// Campos que existem SÓ em Negociacao/NovaNegociacao (não em Cliente/NovoCliente).
// PATCH rejeita qualquer um desses no payload em vez de descartar silenciosamente
// (decisão Task 4.2: 400 é mais seguro que perder dado que o chamador achava
// que ia salvar). `dataContato` e `observacao` existem nos dois tipos — não
// são exclusivos de negociação, por isso ficam de fora dessa lista.
const CAMPOS_SOMENTE_NEGOCIACAO = [
  'clienteId',
  'orcamentoEnviado',
  'resultado',
  'qualidadeContato',
  'naoRespondeu',
  'valorFechado',
  'valorFechadoNumero',
  'pagouSinal',
  'valorSinal',
  'valorSinalNumero',
  'dataPagamentoSinal',
  'vendaPaga',
  'dataPagamentoVenda',
  'dataLembreteChamada',
  'dataMesVenda',
] as const;

function negociacaoRowParaNegociacao(row: {
  id: string;
  cliente_id: string;
  data_contato: string;
  orcamento_enviado: boolean;
  resultado: string;
  qualidade_contato: string | null;
  nao_respondeu: boolean | null;
  valor_fechado: number | null;
  observacao: string | null;
  pagou_sinal: boolean | null;
  valor_sinal: number | null;
  data_pagamento_sinal: string | null;
  venda_paga: boolean | null;
  data_pagamento_venda: string | null;
  data_lembrete_chamada: string | null;
  data_mes_venda: string | null;
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
}): Negociacao {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    dataContato: row.data_contato,
    orcamentoEnviado: row.orcamento_enviado,
    resultado: row.resultado as Negociacao['resultado'],
    qualidadeContato: (row.qualidade_contato ?? undefined) as Negociacao['qualidadeContato'],
    naoRespondeu: row.nao_respondeu || false,
    valorFechado: row.valor_fechado?.toString(),
    observacao: row.observacao ?? undefined,
    pagouSinal: row.pagou_sinal || false,
    valorSinal: row.valor_sinal?.toString(),
    dataPagamentoSinal: row.data_pagamento_sinal ?? undefined,
    vendaPaga: row.venda_paga || false,
    dataPagamentoVenda: row.data_pagamento_venda ?? undefined,
    dataLembreteChamada: row.data_lembrete_chamada ?? undefined,
    dataMesVenda: row.data_mes_venda ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
  };
}

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

    // Fetch cliente + TODAS as negociações (ordenadas mais recente primeiro)
    // — detalhe de um único lead, ao contrário da listagem em
    // GET /api/clientes que embeda só a última. Constrói o design pro futuro
    // /leads/[id] (Task 6.3).
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select(`
        id, data_contato, nome, whatsapp_instagram, email, origem, observacao,
        created_at, categoria, user_id,
        negociacoes(
          id, cliente_id, data_contato, orcamento_enviado, resultado,
          qualidade_contato, nao_respondeu, valor_fechado, observacao,
          pagou_sinal, valor_sinal, data_pagamento_sinal, venda_paga,
          data_pagamento_venda, data_lembrete_chamada, data_mes_venda,
          created_at, created_by, updated_by
        )
      `)
      .eq('id', id)
      .order('data_contato', { ascending: false, foreignTable: 'negociacoes' })
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // totalFollowUps: contagem exata via head:true (count-only, sem baixar linhas).
    const { count: totalFollowUps } = await supabase
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', id);

    const negociacoes = (cliente.negociacoes ?? []).map(negociacaoRowParaNegociacao);

    // ltv: soma de valorFechado das negociações com resultado='Venda'. O tipo
    // Cliente já tem o campo `ltv` pronto pra isso (agregado calculado na
    // leitura, não coluna de clientes) e os dados já estão aqui — calcular
    // agora é barato e evita repetir essa soma no futuro /leads/[id] ou em
    // outro consumidor. Deixado de fora do endpoint de listagem (que só tem
    // a última negociação, não o histórico completo necessário pro cálculo).
    // Fórmula compartilhada com /leads/[id] via src/lib/negociacoes.ts.
    const ltv = calcularLtv(negociacoes);

    const transformedCliente: Cliente = {
      id: cliente.id,
      dataContato: cliente.data_contato,
      nome: cliente.nome,
      whatsappInstagram: cliente.whatsapp_instagram,
      email: cliente.email ?? undefined,
      origem: cliente.origem as Cliente['origem'],
      observacao: cliente.observacao ?? undefined,
      categoria: cliente.categoria ?? undefined,
      userId: cliente.user_id,
      negociacoes,
      ultimaNegociacao: negociacoes[0],
      totalFollowUps: totalFollowUps ?? 0,
      ltv,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dadosAtualizados: Record<string, unknown> = await request.json();
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rejeita (400) qualquer campo que só existe em Negociacao — em vez de
    // descartar silenciosamente, o que faria o chamador achar que salvou um
    // dado de negociação (resultado, valor, pagamento etc.) que na verdade
    // foi ignorado. Campos de negociação são editados via
    // useNegociacoes.editarNegociacao, não por aqui.
    const camposInvalidos = CAMPOS_SOMENTE_NEGOCIACAO.filter(
      (campo) => campo in dadosAtualizados
    );
    if (camposInvalidos.length > 0) {
      return NextResponse.json(
        {
          error: `Campo(s) de negociação não podem ser atualizados via PATCH /api/clientes/[id]: ${camposInvalidos.join(', ')}. Use o endpoint de negociações.`,
        },
        { status: 400 }
      );
    }

    // Prepare update data — só campos de pessoa (Cliente/NovoCliente).
    const updateData: Record<string, string | null> = {};
    if (typeof dadosAtualizados.dataContato === 'string') updateData.data_contato = dadosAtualizados.dataContato;
    if (typeof dadosAtualizados.nome === 'string') updateData.nome = dadosAtualizados.nome;
    if (typeof dadosAtualizados.whatsappInstagram === 'string') updateData.whatsapp_instagram = dadosAtualizados.whatsappInstagram;
    if (typeof dadosAtualizados.origem === 'string') updateData.origem = dadosAtualizados.origem;
    if ('observacao' in dadosAtualizados) updateData.observacao = (dadosAtualizados.observacao as string | null) ?? null;
    if ('categoria' in dadosAtualizados) updateData.categoria = (dadosAtualizados.categoria as string | null) ?? null;
    if ('email' in dadosAtualizados) updateData.email = (dadosAtualizados.email as string | null)?.trim() || null;
    updateData.updated_by = user.id;

    // Update cliente - RLS will automatically filter by user_id
    const { data: cliente, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', id)
      .select('id, data_contato, nome, whatsapp_instagram, email, origem, observacao, created_at, categoria, user_id')
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const transformedCliente: Cliente = {
      id: cliente.id,
      dataContato: cliente.data_contato,
      nome: cliente.nome,
      whatsappInstagram: cliente.whatsapp_instagram,
      email: cliente.email ?? undefined,
      origem: cliente.origem as Cliente['origem'],
      observacao: cliente.observacao ?? undefined,
      categoria: cliente.categoria ?? undefined,
      userId: cliente.user_id,
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
