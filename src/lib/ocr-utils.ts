import Tesseract from 'tesseract.js'

/**
 * Processa uma imagem com OCR e extrai texto com informações de posição
 * @param imageFile Arquivo de imagem ou URL
 * @param onProgress Callback para progresso (opcional)
 * @returns Resultado do OCR com palavras e suas posições
 */
export async function extractTextFromImage(
  imageFile: File | string,
  onProgress?: (progress: number) => void
): Promise<{ text: string; words: Tesseract.Word[]; imageWidth: number }> {
  try {
    const imageSrc = typeof imageFile === 'string' 
      ? imageFile 
      : URL.createObjectURL(imageFile)

    // Usar apenas inglês para melhor reconhecimento de usernames alfanuméricos
    const result = await Tesseract.recognize(imageSrc, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100))
        }
      },
    })

    return {
      text: result.data.text,
      words: result.data.words || [],
      imageWidth: result.data.width || 0,
    }
  } catch (error) {
    console.error('Erro ao processar OCR:', error)
    throw new Error('Falha ao processar imagem com OCR')
  }
}

/**
 * Extrai usernames do Instagram de um texto
 * Foca APENAS nos nomes de usuário que aparecem na primeira linha de cada bloco de chat
 * Ignora mensagens, timestamps e outros textos
 */
export function extractInstagramUsers(text: string): string[] {
  const users = new Set<string>()

  // Normalizar texto: preservar quebras de linha para análise linha por linha
  const lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0)

  // Lista de palavras/padrões que indicam que NÃO é um nome de usuário
  const blacklistPatterns = [
    /^\d+[mhd]?$/i,                    // "25m", "2h", "1d", "25"
    /^\d+:\d+/,                         // "10:30"
    /new\s*messages?/i,
    /sent.*ago/i,
    /reacted.*message/i,
    /sent\s*a\s*reel/i,
    /^play$/i,
    /^typing$/i,
    /^online$/i,
    /^offline$/i,
    /^\d+\+?\s*new/i,                  // "4+ new"
  ]

  const blacklistWords = new Set([
    'new', 'messages', 'message', 'sent', 'ago', 'reacted', 'to', 'your',
    'play', 'typing', 'online', 'offline', 'by', 'reel', 'a', 'the',
    'nova', 'mensagem', 'mensagens', 'enviado', 'atras', 'reagiu', 'sua',
  ])

  for (const line of lines) {
    // Ignorar linhas muito curtas ou muito longas
    if (line.length < 2 || line.length > 80) continue
    
    // Ignorar linhas que claramente são mensagens ou timestamps
    if (blacklistPatterns.some(pattern => pattern.test(line))) continue
    
    // Dividir a linha em palavras
    const words = line.split(/\s+/)
    
    // A primeira palavra geralmente é o username ou início do nome
    const firstWord = words[0]
    
    // Se a primeira palavra parece um username válido do Instagram
    // (letras, números, pontos e underscores, comprimento 2-30)
    const cleanedFirst = firstWord.replace(/[^a-zA-Z0-9._]/g, '')
    
    if (cleanedFirst.length >= 2 && cleanedFirst.length <= 30) {
      // Verificar se é um username válido e não é uma palavra comum
      if (isValidInstagramUsername(cleanedFirst) && !blacklistWords.has(cleanedFirst.toLowerCase())) {
        users.add(`@${cleanedFirst}`)
        continue
      }
    }
    
    // Se a primeira palavra não é um username, pode ser um nome (ex: "Joel Jota", "só meme tranquilo")
    // Nomes geralmente são apenas letras e espaços
    if (/^[a-zA-ZÀ-ÿ]/.test(firstWord)) {
      // Tentar capturar nome completo (primeiras 2-4 palavras que são apenas letras)
      const nameWords: string[] = []
      for (const word of words) {
        // Parar se encontrar número ou palavra da blacklist
        if (/\d/.test(word)) break
        if (blacklistWords.has(word.toLowerCase())) break
        // Só adicionar se for letras/acentos
        if (/^[a-zA-ZÀ-ÿ]+$/.test(word)) {
          nameWords.push(word)
        } else {
          break
        }
        // Limitar a 4 palavras
        if (nameWords.length >= 4) break
      }
      
      if (nameWords.length >= 1) {
        const name = nameWords.join(' ')
        // Se é uma única palavra que pode ser username
        if (nameWords.length === 1 && isValidInstagramUsername(nameWords[0])) {
          if (!blacklistWords.has(nameWords[0].toLowerCase())) {
            users.add(`@${nameWords[0]}`)
          }
        } else if (nameWords.length >= 2) {
          // Nome com múltiplas palavras
          users.add(name)
        }
      }
    }
  }

  // Limpar e normalizar resultados
  const cleanedUsers = Array.from(users)
    .map(u => u.trim())
    .filter(u => u.length >= 2)
    .filter(u => {
      const lower = u.toLowerCase().replace('@', '')
      // Remover se está na blacklist
      if (blacklistWords.has(lower)) return false
      // Remover partes de mensagens juntas
      if (/toyour|yourmessage|sentago|newmessage/i.test(lower)) return false
      return true
    })

  // Remover duplicatas (case-insensitive)
  const uniqueUsers = Array.from(
    new Map(cleanedUsers.map(u => [u.toLowerCase(), u])).values()
  )

  return uniqueUsers
}

/**
 * Valida se um username do Instagram é válido
 */
export function isValidInstagramUsername(username: string): boolean {
  // Remove @ se houver
  const cleaned = username.startsWith('@') ? username.substring(1) : username
  
  // Instagram username rules:
  // - 1-30 caracteres
  // - Apenas letras, números, pontos e underscores
  // - Não pode começar ou terminar com ponto
  const pattern = /^(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{1,30}$/
  
  return pattern.test(cleaned) && !cleaned.startsWith('.') && !cleaned.endsWith('.')
}

/**
 * Normaliza um username do Instagram
 * Remove espaços, caracteres inválidos, etc.
 */
export function normalizeInstagramUsername(username: string): string {
  // Remove espaços e converte para lowercase
  let normalized = username.trim().toLowerCase()
  
  // Garante que tenha @ no início
  if (!normalized.startsWith('@') && /^[a-zA-Z0-9._]+$/.test(normalized)) {
    normalized = `@${normalized}`
  }
  
  return normalized
}

/**
 * Processa imagem completa: OCR + Extração de usuários
 * Nota: Esta função usa Tesseract.js como fallback.
 * Prefira usar a API /api/ocr/vision que usa Google Cloud Vision.
 */
export async function processInstagramScreenshot(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<{ users: string[]; rawText: string }> {
  try {
    // Passo 1: OCR (0-80% do progresso)
    const ocrResult = await extractTextFromImage(
      imageFile,
      (p) => {
        if (onProgress) onProgress(Math.round(p * 0.8))
      }
    )

    // Passo 2: Extração de usuários (80-100% do progresso)
    if (onProgress) onProgress(85)

    // Usar método baseado em texto (mais confiável)
    const users = extractInstagramUsers(ocrResult.text)

    // Remover duplicatas
    const uniqueUsers = Array.from(
      new Map(users.map(u => [u.toLowerCase(), u])).values()
    )

    if (onProgress) onProgress(100)

    return {
      users: uniqueUsers,
      rawText: ocrResult.text,
    }
  } catch (error) {
    console.error('Erro ao processar screenshot:', error)
    throw error
  }
}

