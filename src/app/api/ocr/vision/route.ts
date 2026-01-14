import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'

interface VisionTextAnnotation {
  description: string
  boundingPoly?: {
    vertices: Array<{ x: number; y: number }>
  }
}

interface VisionResponse {
  responses: Array<{
    textAnnotations?: VisionTextAnnotation[]
    fullTextAnnotation?: {
      text: string
    }
    error?: {
      message: string
      code: number
    }
  }>
}

/**
 * POST /api/ocr/vision
 * Processa imagem com Google Cloud Vision OCR
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

    // Verificar API key
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
    if (!apiKey) {
      console.error('GOOGLE_CLOUD_VISION_API_KEY não configurada')
      return NextResponse.json(
        { error: 'Serviço de OCR não configurado' },
        { status: 500 }
      )
    }

    // Obter imagem do request (base64)
    const body = await request.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { error: 'Imagem é obrigatória' },
        { status: 400 }
      )
    }

    // Remover prefixo data:image/... se existir
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '')

    // Chamar Google Cloud Vision API
    const visionResponse = await fetch(`${GOOGLE_VISION_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 50,
              },
            ],
            imageContext: {
              languageHints: ['pt', 'en'],
            },
          },
        ],
      }),
    })

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text()
      console.error('Erro na API do Google Vision:', errorText)
      return NextResponse.json(
        { error: 'Erro ao processar imagem com OCR' },
        { status: 500 }
      )
    }

    const visionData: VisionResponse = await visionResponse.json()

    // Verificar se houve erro na resposta
    if (visionData.responses[0]?.error) {
      console.error('Erro do Google Vision:', visionData.responses[0].error)
      return NextResponse.json(
        { error: visionData.responses[0].error.message || 'Erro no OCR' },
        { status: 500 }
      )
    }

    // Extrair texto completo
    const fullText = visionData.responses[0]?.fullTextAnnotation?.text || ''
    
    // Extrair anotações individuais (palavras/frases)
    const annotations = visionData.responses[0]?.textAnnotations || []

    // Processar e extrair usernames
    const users = extractInstagramUsersFromVisionText(fullText, annotations)

    return NextResponse.json({
      success: true,
      rawText: fullText,
      users,
      annotationsCount: annotations.length,
    })

  } catch (error) {
    console.error('Erro ao processar OCR com Vision:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Extrai usernames do Instagram do texto retornado pelo Google Vision
 */
function extractInstagramUsersFromVisionText(
  fullText: string,
  annotations: VisionTextAnnotation[]
): string[] {
  const users = new Set<string>()

  // Lista de palavras/padrões para ignorar
  const blacklistWords = new Set([
    'new', 'messages', 'message', 'sent', 'ago', 'reacted', 'to', 'your',
    'play', 'typing', 'online', 'offline', 'by', 'reel', 'a', 'the',
    'nova', 'mensagem', 'mensagens', 'enviado', 'atras', 'reagiu', 'sua',
    'camera', 'photo', 'video', 'story', 'stories', 'dm', 'direct',
  ])

  const blacklistPatterns = [
    /^\d+[mhd]?$/i,           // "25m", "2h", "1d"
    /^\d+:\d+/,                // "10:30"
    /^\d+\+?$/,                // "4+", "25"
    /^@$/,                     // Apenas @
  ]

  // Processar o texto completo linha por linha
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  for (const line of lines) {
    // Ignorar linhas que são claramente mensagens
    if (/new messages?|sent.*ago|reacted|typing/i.test(line)) continue
    if (/^\d+[mhd]?\s/i.test(line)) continue // Começa com timestamp
    
    // Pegar a primeira "palavra" da linha (pode ser o username)
    const words = line.split(/\s+/)
    const firstWord = words[0]
    
    // Limpar caracteres especiais
    const cleaned = firstWord.replace(/[^a-zA-Z0-9._@]/g, '')
    
    // Se começa com @, é provavelmente um username
    if (cleaned.startsWith('@') && cleaned.length > 1) {
      const username = cleaned.substring(1)
      if (isValidUsername(username) && !blacklistWords.has(username.toLowerCase())) {
        users.add(`@${username}`)
        continue
      }
    }
    
    // Se parece um username válido (sem @)
    if (isValidUsername(cleaned) && cleaned.length >= 3 && cleaned.length <= 30) {
      if (!blacklistWords.has(cleaned.toLowerCase()) && 
          !blacklistPatterns.some(p => p.test(cleaned))) {
        users.add(`@${cleaned}`)
        continue
      }
    }
    
    // Tentar extrair nome completo (ex: "Joel Jota", "só meme tranquilo")
    // Nome = primeiras palavras que são apenas letras
    const nameWords: string[] = []
    for (const word of words) {
      // Parar se encontrar número ou palavra da blacklist
      if (/\d/.test(word)) break
      if (blacklistWords.has(word.toLowerCase())) break
      // Só adicionar se for letras/acentos
      if (/^[a-zA-ZÀ-ÿ]+$/.test(word)) {
        nameWords.push(word)
      } else if (nameWords.length > 0) {
        break // Parar se já coletamos palavras e encontramos algo diferente
      }
      // Limitar a 4 palavras
      if (nameWords.length >= 4) break
    }
    
    if (nameWords.length >= 2) {
      users.add(nameWords.join(' '))
    } else if (nameWords.length === 1) {
      const single = nameWords[0]
      if (isValidUsername(single) && single.length >= 3 && !blacklistWords.has(single.toLowerCase())) {
        users.add(`@${single}`)
      }
    }
  }

  // Também processar as anotações individuais para capturar usernames isolados
  for (const annotation of annotations.slice(1)) { // Pular o primeiro que é o texto completo
    const text = annotation.description?.trim()
    if (!text || text.length < 3 || text.length > 30) continue
    
    // Se parece um username válido
    const cleaned = text.replace(/[^a-zA-Z0-9._]/g, '')
    if (isValidUsername(cleaned) && 
        !blacklistWords.has(cleaned.toLowerCase()) &&
        !blacklistPatterns.some(p => p.test(cleaned))) {
      // Verificar se tem underscore ou ponto (mais provável ser username)
      if (cleaned.includes('_') || cleaned.includes('.')) {
        users.add(`@${cleaned}`)
      }
    }
  }

  return Array.from(users)
}

/**
 * Valida se um texto é um username válido do Instagram
 */
function isValidUsername(username: string): boolean {
  if (!username || username.length < 1 || username.length > 30) return false
  // Instagram username: letras, números, pontos e underscores
  const pattern = /^[a-zA-Z0-9._]+$/
  return pattern.test(username) && !username.startsWith('.') && !username.endsWith('.')
}





