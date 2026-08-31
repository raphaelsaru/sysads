'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { CalendarOff } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useGoogleCalendarEvents, MonthCount } from '@/hooks/useGoogleCalendarEvents'
import CalendarioMensal from '@/components/calendario/CalendarioMensal'
import DiaEventosDialog from '@/components/calendario/DiaEventosDialog'
import ResumoMensal from '@/components/calendario/ResumoMensal'
import TatuadorSelector, { TatuadorOption } from '@/components/calendario/TatuadorSelector'

function CalendarioContent() {
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role === 'admin'

  const [tatuadores, setTatuadores] = useState<TatuadorOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [windowStart, setWindowStart] = useState(() => new Date())
  const [monthCounts, setMonthCounts] = useState<MonthCount[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const { events, loading, error, notConnected, buscarEventosDoMes, buscarResumo } = useGoogleCalendarEvents()

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/google-calendar/mappings', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const withCalendar = (data.mappings ?? []).filter((m: { calendar_id: string | null }) => m.calendar_id)
        setTatuadores(withCalendar)
        if (withCalendar.length > 0) setSelectedUserId(withCalendar[0].id)
      })
      .catch(() => {})
  }, [isAdmin])

  const targetUserId = isAdmin ? selectedUserId : (userProfile?.id ?? null)

  useEffect(() => {
    if (!targetUserId) return
    buscarEventosDoMes(targetUserId, format(currentMonth, 'yyyy-MM'))
  }, [targetUserId, currentMonth, buscarEventosDoMes])

  useEffect(() => {
    if (!targetUserId) return
    buscarResumo(targetUserId, format(windowStart, 'yyyy-MM'), 8).then(setMonthCounts)
  }, [targetUserId, windowStart, buscarResumo])

  const handleWindowShift = useCallback((direction: -1 | 1) => {
    setWindowStart((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + direction * 8)
      return next
    })
  }, [])

  const eventsForSelectedDay = selectedDay
    ? events.filter((e) => e.start.slice(0, 10) === format(selectedDay, 'yyyy-MM-dd'))
    : []

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Agenda</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visão da agenda sincronizada com o Google Calendar.
          </p>
        </div>

        {isAdmin && tatuadores.length > 0 && (
          <TatuadorSelector options={tatuadores} value={selectedUserId} onChange={setSelectedUserId} />
        )}

        {isAdmin && tatuadores.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum tatuador com agenda configurada ainda. Configure em Admin → Google Calendar.
          </p>
        )}

        {notConnected && (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
            <CalendarOff className="h-5 w-5 shrink-0" />
            {isAdmin
              ? 'A conexão com o Google Calendar expirou ou não foi configurada. Acesse Admin → Google Calendar.'
              : 'Sua agenda ainda não foi conectada. Fale com o suporte.'}
          </div>
        )}

        {!notConnected && targetUserId && (
          <>
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <CalendarioMensal
                currentMonth={currentMonth}
                events={events}
                onMonthChange={setCurrentMonth}
                onDayClick={setSelectedDay}
              />
              <ResumoMensal
                currentMonth={currentMonth}
                currentMonthEvents={events}
                monthCounts={monthCounts}
                onWindowShift={handleWindowShift}
              />
            </div>

            {loading && <p className="text-sm text-muted-foreground">Carregando eventos…</p>}
          </>
        )}

        {!isAdmin && !targetUserId && (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}

        <DiaEventosDialog
          date={selectedDay}
          events={eventsForSelectedDay}
          onClose={() => setSelectedDay(null)}
        />
      </div>
    </MainLayout>
  )
}

export default function CalendarioPage() {
  return (
    <ProtectedRoute>
      <CalendarioContent />
    </ProtectedRoute>
  )
}
