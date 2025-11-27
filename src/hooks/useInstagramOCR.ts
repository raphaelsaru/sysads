import { useState } from 'react'
import { OCRDetectedUser } from '@/types/crm'

interface UseInstagramOCRReturn {
  processImage: (file: File) => Promise<void>
  checkDuplicates: (users: string[]) => Promise<OCRDetectedUser[]>
  importUsers: (users: string[]) => Promise<{ success: number; failed: number }>
  processing: boolean
  progress: number
  error: string | null
  detectedUsers: OCRDetectedUser[]
  rawText: string
}

/**
 * Converte File para base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function useInstagramOCR(): UseInstagramOCRReturn {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [detectedUsers, setDetectedUsers] = useState<OCRDetectedUser[]>([])
  const [rawText, setRawText] = useState('')

  /**
   * Processa imagem com Google Cloud Vision OCR
   */
  const processImage = async (file: File) => {
    try {
      setProcessing(true)
      setProgress(0)
      setError(null)
      setDetectedUsers([])
      setRawText('')

      // Validar arquivo
      if (!file.type.startsWith('image/')) {
        throw new Error('Arquivo deve ser uma imagem')
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB
        throw new Error('Imagem muito grande. Tamanho máximo: 10MB')
      }

      setProgress(10)

      // Converter imagem para base64
      const base64Image = await fileToBase64(file)
      
      setProgress(30)

      // Enviar para API do Google Vision
      const response = await fetch('/api/ocr/vision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      })

      setProgress(70)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao processar imagem')
      }

      const result = await response.json()

      setRawText(result.rawText || '')

      // Debug: mostrar texto bruto no console
      console.log('=== Google Vision OCR Raw Text ===')
      console.log(result.rawText)
      console.log('=== Detected Users ===')
      console.log(result.users)

      if (!result.users || result.users.length === 0) {
        setError('Nenhum usuário detectado na imagem. Tente uma imagem mais clara.')
        setProcessing(false)
        return
      }

      setProgress(85)

      // Verificar duplicatas via API
      const duplicatesResult = await checkDuplicates(result.users)
      setDetectedUsers(duplicatesResult)
      setProgress(100)
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      setError(err instanceof Error ? err.message : 'Erro ao processar imagem')
    } finally {
      setProcessing(false)
    }
  }

  /**
   * Verifica quais usuários já existem no CRM
   */
  const checkDuplicates = async (users: string[]): Promise<OCRDetectedUser[]> => {
    try {
      const response = await fetch('/api/ocr/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao verificar duplicatas')
      }

      const data = await response.json()
      return data.users || []
    } catch (err) {
      console.error('Erro ao verificar duplicatas:', err)
      throw err
    }
  }

  /**
   * Importa usuários selecionados para o CRM
   */
  const importUsers = async (users: string[]): Promise<{ success: number; failed: number }> => {
    try {
      if (users.length === 0) {
        throw new Error('Nenhum usuário selecionado para importar')
      }

      const response = await fetch('/api/clientes/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao importar usuários')
      }

      const data = await response.json()
      
      return {
        success: data.success || 0,
        failed: data.failed || 0,
      }
    } catch (err) {
      console.error('Erro ao importar usuários:', err)
      throw err
    }
  }

  return {
    processImage,
    checkDuplicates,
    importUsers,
    processing,
    progress,
    error,
    detectedUsers,
    rawText,
  }
}

