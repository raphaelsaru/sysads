'use client'

import { useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CalendarEvent } from '@/hooks/useGoogleCalendarEvents'
import { isDayOffEvent } from '@/lib/calendario-utils'

interface CalendarioMensalProps {
  currentMonth: Date
  events: CalendarEvent[]
  onMonthChange: (date: Date) => void
  onDayClick: (date: Date) => void
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function CalendarioMensal({ currentMonth, events, onMonthChange, onDayClick }: CalendarioMensalProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth))
    const end = endOfWeek(endOfMonth(currentMonth))
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of events) {
      const dateKey = event.start.slice(0, 10)
      map.set(dateKey, (map.get(dateKey) ?? 0) + 1)
    }
    return map
  }, [events])

  const dayOffDays = useMemo(() => {
    const set = new Set<string>()
    for (const event of events) {
      if (isDayOffEvent(event.title)) set.add(event.start.slice(0, 10))
    }
    return set
  }, [events])

  const goToPrevMonth = () => {
    const prev = new Date(currentMonth)
    prev.setMonth(prev.getMonth() - 1)
    onMonthChange(prev)
  }

  const goToNextMonth = () => {
    const next = new Date(currentMonth)
    next.setMonth(next.getMonth() + 1)
    onMonthChange(next)
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={goToPrevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="py-1">{dia}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const count = eventsByDay.get(dateKey) ?? 0
          const inMonth = isSameMonth(day, currentMonth)
          const isDayOff = dayOffDays.has(dateKey)

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDayClick(day)}
              disabled={count === 0}
              className={`flex aspect-square flex-col items-center justify-center rounded-md border text-sm transition-colors
                ${inMonth ? 'border-border/60' : 'border-transparent text-muted-foreground/40'}
                ${isToday(day) ? 'ring-1 ring-primary' : ''}
                ${count > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                ${isDayOff ? 'bg-destructive/15 border-destructive/40' : count > 0 ? 'bg-primary/10' : ''}
              `}
            >
              <span>{format(day, 'd')}</span>
              {count > 0 && (
                <span className={`mt-0.5 text-[10px] font-semibold ${isDayOff ? 'text-destructive' : 'text-primary'}`}>
                  {count} {count === 1 ? 'evento' : 'eventos'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
