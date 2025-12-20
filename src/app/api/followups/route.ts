import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { FollowUp, NovoFollowUp } from '@/types/crm';

// Headers CORS para permitir requisições
function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    'https://web.whatsapp.com',
    'http://localhost:3000',
    'https://www.prizely.com.br',
    'https://prizely.com.br',
  ];

  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('http://localhost:') ||
    origin.includes('prizely.com.br')
  );

  let corsOrigin: string;
  let allowCredentials: string;
  
  if (!origin) {
    corsOrigin = '*';
    allowCredentials = 'false';
  } else if (isAllowed || origin.startsWith('chrome-extension://')) {
    corsOrigin = origin;
    allowCredentials = 'true';
  } else {
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
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  return new NextResponse(null, {
    status: 200,
    headers,
  });
}

// GET: Listar follow-ups de um cliente
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('cliente_id');

    if (!clienteId) {
      const errorResponse = NextResponse.json(
        { error: 'cliente_id é obrigatório' },
        { status: 400 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Buscar follow-ups do cliente - RLS vai filtrar automaticamente por tenant_id
    const { data: followUps, error } = await supabase
      .from('follow_ups')
      .select(`
        id,
        cliente_id,
        observacao,
        respondeu,
        numero_followup,
        created_at,
        created_by,
        tenant_id
      `)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar follow-ups:', error);
      const errorResponse = NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Transformar para o formato da interface
    const transformedFollowUps: FollowUp[] = (followUps || []).map(followUp => ({
      id: followUp.id,
      clienteId: followUp.cliente_id,
      observacao: followUp.observacao,
      respondeu: followUp.respondeu,
      numeroFollowup: followUp.numero_followup,
      createdAt: followUp.created_at,
      createdBy: followUp.created_by,
      tenantId: followUp.tenant_id,
    }));

    const response = NextResponse.json(transformedFollowUps);
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Erro ao buscar follow-ups:', error);
    const errorResponse = NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    return errorResponse;
  }
}

// POST: Criar novo follow-up
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const novoFollowUp: NovoFollowUp = await request.json();
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Validar dados
    if (!novoFollowUp.clienteId || !novoFollowUp.observacao) {
      const errorResponse = NextResponse.json(
        { error: 'clienteId e observacao são obrigatórios' },
        { status: 400 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Verificar se o cliente existe e pertence ao tenant do usuário
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, tenant_id')
      .eq('id', novoFollowUp.clienteId)
      .single();

    if (clienteError || !cliente) {
      const errorResponse = NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Inserir follow-up
    // O trigger vai calcular automaticamente o numero_followup
    const { data: followUp, error } = await supabase
      .from('follow_ups')
      .insert({
        cliente_id: novoFollowUp.clienteId,
        observacao: novoFollowUp.observacao,
        respondeu: novoFollowUp.respondeu || false,
        tenant_id: cliente.tenant_id,
        created_by: user.id,
        // numero_followup será calculado pelo trigger
        numero_followup: 0, // O trigger vai substituir isso
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar follow-up:', error);
      const errorResponse = NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Transformar para o formato da interface
    const transformedFollowUp: FollowUp = {
      id: followUp.id,
      clienteId: followUp.cliente_id,
      observacao: followUp.observacao,
      respondeu: followUp.respondeu,
      numeroFollowup: followUp.numero_followup,
      createdAt: followUp.created_at,
      createdBy: followUp.created_by,
      tenantId: followUp.tenant_id,
    };

    const response = NextResponse.json(transformedFollowUp, { status: 201 });
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Erro ao criar follow-up:', error);
    const errorResponse = NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    return errorResponse;
  }
}

// PUT: Atualizar follow-up existente
export async function PUT(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const { id, observacao, respondeu }: { id: string; observacao?: string; respondeu?: boolean } = await request.json();
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Validar dados
    if (!id) {
      const errorResponse = NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Verificar se o follow-up existe e pertence ao tenant do usuário
    const { data: followUpExistente, error: followUpError } = await supabase
      .from('follow_ups')
      .select('id, tenant_id, created_by')
      .eq('id', id)
      .single();

    if (followUpError || !followUpExistente) {
      const errorResponse = NextResponse.json(
        { error: 'Follow-up não encontrado' },
        { status: 404 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Preparar dados para atualização
    const updateData: { observacao?: string; respondeu?: boolean } = {};
    if (observacao !== undefined) updateData.observacao = observacao;
    if (respondeu !== undefined) updateData.respondeu = respondeu;

    // Atualizar follow-up
    const { data: followUp, error } = await supabase
      .from('follow_ups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar follow-up:', error);
      const errorResponse = NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Transformar para o formato da interface
    const transformedFollowUp: FollowUp = {
      id: followUp.id,
      clienteId: followUp.cliente_id,
      observacao: followUp.observacao,
      respondeu: followUp.respondeu,
      numeroFollowup: followUp.numero_followup,
      createdAt: followUp.created_at,
      createdBy: followUp.created_by,
      tenantId: followUp.tenant_id,
    };

    const response = NextResponse.json(transformedFollowUp);
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Erro ao atualizar follow-up:', error);
    const errorResponse = NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    return errorResponse;
  }
}

