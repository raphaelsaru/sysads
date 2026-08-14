'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'

export interface ToolChamada {
  tool: string
  args?: Record<string, unknown>
  linhas?: number
  ok?: boolean
  janela?: string
  truncado?: boolean
  dados?: Array<Record<string, unknown>>
  erro?: string
}

export interface Mensagem {
  id: string
  papel: 'user' | 'assistant'
  texto: string
  tools?: ToolChamada[]
  bloqueado?: boolean
}

interface RespostaAssistente {
  texto?: string
  toolsChamadas?: ToolChamada[]
  bloqueado?: boolean
  erro?: string
}

const ERROS_POR_STATUS: Record<number, string> = {
  401: 'Sessão expirada. Faça login novamente.',
  403: 'Você não tem acesso ao assistente.',
  429: 'Muitas perguntas seguidas. Aguarde um instante.',
  502: 'Assistente indisponível no momento.',
  503: 'Assistente indisponível no momento.',
}

function novoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fusoHorario() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

/**
 * Conversa efêmera, só em memória (sem localStorage) — por design.
 *
 * O backend é STATELESS: recebe uma pergunta por vez, sem histórico. Por isso
 * o hook não envia turnos anteriores (o servidor ignoraria) e a UI não deve
 * sugerir que existe memória entre perguntas.
 */
export function useAssistant() {
  const { impersonatedUserId } = useAdmin()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const enviar = useCallback(
    async (pergunta: string) => {
      const texto = pergunta.trim()
      if (!texto || enviando) return

      setErro(null)
      setEnviando(true)
      setMensagens((prev) => [...prev, { id: novoId(), papel: 'user', texto }])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pergunta: texto,
            impersonateUserId: impersonatedUserId ?? undefined,
            timezone: fusoHorario(),
          }),
          signal: controller.signal,
        })

        const dados = (await res.json().catch(() => ({}))) as RespostaAssistente

        if (!res.ok) {
          setErro(dados?.erro || ERROS_POR_STATUS[res.status] || 'Não foi possível responder agora.')
          return
        }

        // Recusa do guard vem com 200 + bloqueado: true — é uma resposta normal.
        setMensagens((prev) => [
          ...prev,
          {
            id: novoId(),
            papel: 'assistant',
            texto: dados?.texto || 'Sem resposta.',
            tools: dados?.toolsChamadas,
            bloqueado: dados?.bloqueado,
          },
        ])
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setErro('Falha de conexão com o assistente.')
      } finally {
        setEnviando(false)
        abortRef.current = null
      }
    },
    [enviando, impersonatedUserId]
  )

  const limpar = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMensagens([])
    setErro(null)
    setEnviando(false)
  }, [])

  return { mensagens, enviando, erro, enviar, limpar }
}
