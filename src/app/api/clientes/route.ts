import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { Cliente, NovoCliente } from '@/types/crm';

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
  } else if (isAllowed || origin.startsWith('chrome-extension://')) {
    // Origem permitida ou extensão do Chrome
    corsOrigin = origin;
    allowCredentials = 'true';
  } else {
    // Origem não permitida - por segurança, não permitir
    // Mas para desenvolvimento, podemos ser mais permissivos
    corsOrigin = origin;
    allowCredentials = 'true';
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
    const novoCliente: NovoCliente = await request.json();
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