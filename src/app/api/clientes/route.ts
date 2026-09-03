import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { Cliente, Negociacao } from '@/types/crm';

// Payload recebido no POST: formato plano legado (pessoa+negociação juntos),
// usado pela extensão do Chrome (chrome-extension/popup.js, sidebar.js,
// content.js) — não muda, mesmo com a separação pessoa/negociação interna
// (Fase 2 / Task 4.1). orcamentoEnviado chega como string 'Sim'/'Não'.
interface NovoClientePayload {
  dataContato: string;
  nome: string;
  whatsappInstagram: string;
  origem: Cliente['origem'];
  orcamentoEnviado?: 'Sim' | 'Não';
  resultado?: Negociacao['resultado'];
  qualidadeContato?: Negociacao['qualidadeContato'];
  naoRespondeu?: boolean;
  valorFechado?: string;
  observacao?: string;
  pagouSinal?: boolean;
  valorSinal?: string;
  dataPagamentoSinal?: string;
  vendaPaga?: boolean;
  dataPagamentoVenda?: string;
  dataLembreteChamada?: string;
}

// Headers CORS para permitir requisições da extensão do Chrome
function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    'https://web.whatsapp.com',
    'http://localhost:3000',
    'https://www.prizely.com.br',
    'https://prizely.com.br',
  ];

  // Verificar se a origem é permitida
  // Extensões do Chrome têm origem como 'chrome-extension://...'
  // WhatsApp Web tem origem como 'https://web.whatsapp.com'
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('http://localhost:') ||
    origin.includes('prizely.com.br')
  );

  // Quando usando credentials: 'include', não podemos usar '*' como origem
  // Se a origem não for permitida mas existir, ainda retornamos ela (para permitir extensões)
  // Se não houver origem (null), retornamos '*' mas sem credentials
  let corsOrigin: string;
  let allowCredentials: string;
  
  if (!origin) {
    // Sem origem (requisição same-origin ou sem header Origin)
    corsOrigin = '*';
    allowCredentials = 'false';
  } else if (isAllowed) {
    // Origem permitida
    corsOrigin = origin;
    allowCredentials = 'true';
  } else {
    // Origem não permitida — bloquear credentials
    corsOrigin = 'null';
    allowCredentials = 'false';
  }

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': allowCredentials,
  };
}

// Tratar preflight requests (OPTIONS)
// Nota: O middleware também trata OPTIONS, mas este handler serve como fallback
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  return new NextResponse(null, {
    status: 200,
    headers,
  });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      // Adicionar headers CORS mesmo em caso de erro
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Fetch clientes — RLS filters by authenticated user. Embed só a
    // negociação mais recente por cliente (mesmo padrão de
    // src/hooks/useClientes.ts's selectClientes()) — lista não precisa do
    // histórico completo, só da "última negociação" pra exibir na tabela.
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select(`
        id,
        data_contato,
        nome,
        whatsapp_instagram,
        origem,
        observacao,
        created_at,
        categoria,
        negociacoes(
          id, cliente_id, data_contato, orcamento_enviado, resultado,
          qualidade_contato, nao_respondeu, valor_fechado, observacao,
          pagou_sinal, valor_sinal, data_pagamento_sinal, venda_paga,
          data_pagamento_venda, data_lembrete_chamada, data_mes_venda,
          created_at, created_by, updated_by
        )
      `)
      .order('data_contato', { ascending: false })
      .order('data_contato', { ascending: false, foreignTable: 'negociacoes' })
      .limit(1, { foreignTable: 'negociacoes' });

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      const errorResponse = NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
      // Adicionar headers CORS mesmo em caso de erro
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Buscar contagens de follow-ups para todos os clientes
    const clienteIds = clientes?.map(c => c.id) || [];
    let followUpsCounts: Record<string, number> = {};
    
    if (clienteIds.length > 0) {
      const { data: followUpsData, error: followUpsError } = await supabase
        .from('follow_ups')
        .select('cliente_id')
        .in('cliente_id', clienteIds);

      if (!followUpsError && followUpsData) {
        // Contar follow-ups por cliente
        followUpsCounts = followUpsData.reduce((acc, fu) => {
          acc[fu.cliente_id] = (acc[fu.cliente_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Transform to match existing interface — negociação mais recente (se
    // houver) vira `ultimaNegociacao`, mesma convenção de useClientes.ts.
    const transformedClientes: Cliente[] = (clientes || []).map(cliente => {
      const negociacaoRow = cliente.negociacoes?.[0];
      const ultimaNegociacao: Negociacao | undefined = negociacaoRow
        ? {
            id: negociacaoRow.id,
            clienteId: negociacaoRow.cliente_id,
            dataContato: negociacaoRow.data_contato,
            orcamentoEnviado: negociacaoRow.orcamento_enviado,
            resultado: negociacaoRow.resultado as Negociacao['resultado'],
            qualidadeContato: negociacaoRow.qualidade_contato as Negociacao['qualidadeContato'],
            naoRespondeu: negociacaoRow.nao_respondeu || false,
            valorFechado: negociacaoRow.valor_fechado?.toString(),
            observacao: negociacaoRow.observacao,
            pagouSinal: negociacaoRow.pagou_sinal || false,
            valorSinal: negociacaoRow.valor_sinal?.toString(),
            dataPagamentoSinal: negociacaoRow.data_pagamento_sinal,
            vendaPaga: negociacaoRow.venda_paga || false,
            dataPagamentoVenda: negociacaoRow.data_pagamento_venda,
            dataLembreteChamada: negociacaoRow.data_lembrete_chamada,
            dataMesVenda: negociacaoRow.data_mes_venda,
            createdAt: negociacaoRow.created_at,
            createdBy: negociacaoRow.created_by,
            updatedBy: negociacaoRow.updated_by,
          }
        : undefined;

      return {
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem as Cliente['origem'],
        observacao: cliente.observacao,
        categoria: cliente.categoria,
        ultimaNegociacao,
        totalFollowUps: followUpsCounts[cliente.id] || 0,
      };
    });

    const response = NextResponse.json(transformedClientes);
    // Adicionar headers CORS
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    const errorResponse = NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
    // Adicionar headers CORS mesmo em caso de erro
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    return errorResponse;
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const novoCliente: NovoClientePayload = await request.json();
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      // Adicionar headers CORS mesmo em caso de erro
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Acha-ou-cria a pessoa (dedup por telefone/instagram normalizado, mesmo
    // contrato do adicionarCliente em src/hooks/useClientes.ts). Sempre cria
    // uma negociação nova em seguida — o payload da extensão continua
    // misturando pessoa+negociação num único POST, aqui é que se separa
    // internamente (decisão Fase 2: extensão não muda).
    const { data: resultado, error: rpcError } = await supabase
      .rpc('find_or_create_cliente', {
        p_user_id: user.id,
        p_data_contato: novoCliente.dataContato,
        p_nome: novoCliente.nome,
        p_identificador: novoCliente.whatsappInstagram,
        p_origem: novoCliente.origem,
        p_created_by: user.id,
      })
      .single();

    if (rpcError || !resultado) {
      console.error('Erro ao criar/encontrar cliente:', rpcError);
      const errorResponse = NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    const { id: clienteId } = resultado as { id: string; created: boolean };

    // orcamentoEnviado chega da extensão como string 'Sim'/'Não' — converte
    // pro boolean que a coluna negociacoes.orcamento_enviado espera.
    const orcamentoEnviadoBool = novoCliente.orcamentoEnviado === 'Sim';

    const { data: negociacao, error: negociacaoError } = await supabase
      .from('negociacoes')
      .insert({
        cliente_id: clienteId,
        data_contato: novoCliente.dataContato,
        orcamento_enviado: orcamentoEnviadoBool,
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
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (negociacaoError || !negociacao) {
      console.error('Erro ao criar negociação:', negociacaoError);
      const errorResponse = NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    const { data: cliente, error } = await supabase
      .from('clientes')
      .select()
      .eq('id', clienteId)
      .single();

    if (error || !cliente) {
      console.error('Erro ao buscar cliente recém-criado:', error);
      const errorResponse = NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Transform to match existing interface (payload plano pessoa+negociação,
    // formato que a extensão já espera — não muda o contrato externo).
    const transformedCliente: Cliente & {
      orcamentoEnviado: 'Sim' | 'Não';
      resultado: Negociacao['resultado'];
      qualidadeContato: Negociacao['qualidadeContato'];
      naoRespondeu: boolean;
      valorFechado?: string;
      pagouSinal: boolean;
      valorSinal?: string;
      dataPagamentoSinal?: string;
      vendaPaga: boolean;
      dataPagamentoVenda?: string;
      dataLembreteChamada?: string;
    } = {
      id: cliente.id,
      dataContato: cliente.data_contato,
      nome: cliente.nome,
      whatsappInstagram: cliente.whatsapp_instagram,
      origem: cliente.origem as Cliente['origem'],
      orcamentoEnviado: negociacao.orcamento_enviado ? 'Sim' : 'Não',
      resultado: negociacao.resultado as Negociacao['resultado'],
      qualidadeContato: negociacao.qualidade_contato as Negociacao['qualidadeContato'],
      naoRespondeu: negociacao.nao_respondeu || false,
      valorFechado: negociacao.valor_fechado?.toString(),
      observacao: cliente.observacao,
      pagouSinal: negociacao.pagou_sinal || false,
      valorSinal: negociacao.valor_sinal?.toString(),
      dataPagamentoSinal: negociacao.data_pagamento_sinal,
      vendaPaga: negociacao.venda_paga || false,
      dataPagamentoVenda: negociacao.data_pagamento_venda,
      dataLembreteChamada: negociacao.data_lembrete_chamada,
    };

    const response = NextResponse.json(transformedCliente, { status: 201 });
    // Adicionar headers CORS
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    const errorResponse = NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
    // Adicionar headers CORS mesmo em caso de erro
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    return errorResponse;
  }
}