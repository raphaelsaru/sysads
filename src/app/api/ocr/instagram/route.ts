import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * POST /api/ocr/instagram
 * Processa imagem com OCR e extrai usuários do Instagram
 * Apenas usuários com feature habilitada podem acessar
 * 
 * NOTA: O processamento OCR acontece no cliente (frontend) usando Tesseract.js
 * Esta API apenas valida permissões e retorna dados de duplicatas
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar perfil do usuário com tenant
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        tenant_id,
        role,
        tenant:tenants(id, name, settings)
      `)
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.tenant) {
      return NextResponse.json(
        { error: 'Perfil ou tenant não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o tenant tem a feature habilitada
    const tenant = Array.isArray(profile.tenant) ? profile.tenant[0] : profile.tenant
    const settings = tenant.settings || {}
    const ocrEnabled = settings.ocr_instagram_enabled || false

    if (!ocrEnabled) {
      return NextResponse.json(
        { 
          error: 'Feature de OCR Instagram não está habilitada para seu tenant',
          feature_enabled: false,
        },
        { status: 403 }
      )
    }

    // Obter dados do request
    const body = await request.json()
    const { users } = body

    if (!users || !Array.isArray(users)) {
      return NextResponse.json(
        { error: 'Lista de usuários é obrigatória' },
        { status: 400 }
      )
    }

    // Buscar clientes existentes para marcar duplicatas
    const { data: existingClientes, error: fetchError } = await supabase
      .from('clientes')
      .select('id, whatsapp_instagram')
      .in('whatsapp_instagram', users)

    if (fetchError) {
      console.error('Erro ao buscar clientes existentes:', fetchError)
      return NextResponse.json(
        { error: 'Erro ao verificar duplicatas' },
        { status: 500 }
      )
    }

    // Criar mapa de duplicatas
    const duplicatesMap = new Map<string, string>()
    existingClientes?.forEach(cliente => {
      duplicatesMap.set(
        cliente.whatsapp_instagram.toLowerCase(),
        cliente.id
      )
    })

    // Marcar cada usuário como duplicado ou não
    const detectedUsers = users.map(username => {
      const normalizedUsername = username.toLowerCase()
      const isDuplicate = duplicatesMap.has(normalizedUsername)
      
      return {
        username,
        confidence: 1, // No frontend, o Tesseract retorna a confiança real
        isDuplicate,
        existingClientId: isDuplicate ? duplicatesMap.get(normalizedUsername) : undefined,
      }
    })

    return NextResponse.json({
      users: detectedUsers,
      total: users.length,
      duplicates: detectedUsers.filter(u => u.isDuplicate).length,
      new: detectedUsers.filter(u => !u.isDuplicate).length,
      feature_enabled: true,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Erro ao processar OCR:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ocr/instagram/status
 * Verifica se o usuário tem acesso à feature de OCR Instagram
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { enabled: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar perfil do usuário com tenant
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        tenant_id,
        tenant:tenants(id, name, settings)
      `)
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.tenant) {
      return NextResponse.json(
        { enabled: false, error: 'Perfil ou tenant não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o tenant tem a feature habilitada
    const tenant = Array.isArray(profile.tenant) ? profile.tenant[0] : profile.tenant
    const settings = tenant.settings || {}
    const ocrEnabled = settings.ocr_instagram_enabled || false

    return NextResponse.json({
      enabled: ocrEnabled,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
    })
  } catch (error) {
    console.error('Erro ao verificar status da feature OCR:', error)
    return NextResponse.json(
      { enabled: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}



