'use client'

import { useState, useCallback } from 'react'

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
}

export interface MonthCount {
  month: string
  count: number
}

interface UseGoogleCalendarEventsResult {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
  notConnected: boolean
  buscarEventosDoMes: (userId: string | null, month: string) => Promise<void>
  buscarResumo: (userId: string | null, startMonth: string, months?: number) => Promise<MonthCount[]>
}

export function useGoogleCalendarEvents(): UseGoogleCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)

  const buscarEventosDoMes = useCallback(async (userId: string | null, month: string) => {
    setLoading(true)
    setError(null)
    setNotConnected(false)

    try {
      const params = new URLSearchParams({ month })
      if (userId) params.set('userId', userId)

      const response = await fetch(`/api/google-calendar/events?${params.toString()}`, {
        credentials: 'include',
      })

      if (response.status === 409) {
        setNotConnected(true)
        setEvents([])
        return
      }

      if (!response.ok) {
        throw new Error('Erro ao buscar eventos da agenda')
      }

      const data = await response.json()
      setEvents(data.events ?? [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar eventos da agenda'
      setError(errorMessage)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  const buscarResumo = useCallback(async (userId: string | null, startMonth: string, months = 8): Promise<MonthCount[]> => {
    const params = new URLSearchParams({ startMonth, months: String(months) })
    if (userId) params.set('userId', userId)

    const response = await fetch(`/api/google-calendar/events/range?${params.toString()}`, {
      credentials: 'include',
    })

    if (response.status === 409) {
      setNotConnected(true)
      return []
    }

    if (!response.ok) {
      throw new Error('Erro ao buscar resumo da agenda')
    }

    const data = await response.json()
    return data.months ?? []
  }, [])

  return { events, loading, error, notConnected, buscarEventosDoMes, buscarResumo }
}
