'use client'

import { useState, useCallback } from 'react'
import { FollowUp, NovoFollowUp } from '@/types/crm'

interface UseFollowUpsResult {
  followUps: FollowUp[]
  loading: boolean
  error: string | null
  buscarFollowUps: (clienteId: string) => Promise<void>
  criarFollowUp: (novoFollowUp: NovoFollowUp) => Promise<FollowUp>
  editarFollowUp: (id: string, dados: { observacao?: string; respondeu?: boolean }) => Promise<FollowUp>
  totalFollowUps: (clienteId: string) => number
}

export function useFollowUps(): UseFollowUpsResult {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscarFollowUps = useCallback(async (clienteId: string) => {
    if (!clienteId) {
      setFollowUps([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/followups?cliente_id=${clienteId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao buscar follow-ups')
      }

      const data: FollowUp[] = await response.json()
      setFollowUps(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar follow-ups'
      setError(errorMessage)
      console.error('Erro ao buscar follow-ups:', err)
      setFollowUps([])
    } finally {
      setLoading(false)
    }
  }, [])

  const criarFollowUp = useCallback(async (novoFollowUp: NovoFollowUp): Promise<FollowUp> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/followups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(novoFollowUp),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao criar follow-up')
      }

      const followUp: FollowUp = await response.json()
      
      // Adicionar o novo follow-up à lista se for do mesmo cliente
      setFollowUps((prev) => {
        if (prev.length > 0 && prev[0]?.clienteId === followUp.clienteId) {
          return [followUp, ...prev]
        }
        return prev
      })

      return followUp
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar follow-up'
      setError(errorMessage)
      console.error('Erro ao criar follow-up:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const editarFollowUp = useCallback(async (id: string, dados: { observacao?: string; respondeu?: boolean }): Promise<FollowUp> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/followups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id, ...dados }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao editar follow-up')
      }

      const followUp: FollowUp = await response.json()
      
      // Atualizar o follow-up na lista
      setFollowUps((prev) => 
        prev.map((fu) => fu.id === followUp.id ? followUp : fu)
      )

      return followUp
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao editar follow-up'
      setError(errorMessage)
      console.error('Erro ao editar follow-up:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const totalFollowUps = useCallback((clienteId: string): number => {
    if (!clienteId) return 0
    return followUps.filter((fu) => fu.clienteId === clienteId).length
  }, [followUps])

  return {
    followUps,
    loading,
    error,
    buscarFollowUps,
    criarFollowUp,
    editarFollowUp,
    totalFollowUps,
  }
}

