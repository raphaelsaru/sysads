'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CalendarEvent } from '@/hooks/useGoogleCalendarEvents'
import { isDayOffEvent } from '@/lib/calendario-utils'

interface DiaEventosDialogProps {
  date: Date | null
  events: CalendarEvent[]
  onClose: () => void
}

export default function DiaEventosDialog({ date, events, onClose }: DiaEventosDialogProps) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">
            {date ? format(date, "EEEE, d 'de' MMMM", { locale: ptBR }) : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum evento nesse dia.</p>
          )}
          {events.map((event) => {
            const isDayOff = isDayOffEvent(event.title)
            return (
            <div
              key={event.id}
              className={`flex items-start gap-3 rounded-md border p-3 ${isDayOff ? 'border-destructive/40 bg-destructive/10' : 'border-border/60'}`}
            >
              <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${isDayOff ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div>
                <p className={`text-sm font-medium ${isDayOff ? 'text-destructive' : ''}`}>{event.title}</p>
                {!event.allDay && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.start), 'HH:mm')} – {format(new Date(event.end), 'HH:mm')}
                  </p>
                )}
                {event.allDay && (
                  <p className="text-xs text-muted-foreground">Dia inteiro</p>
                )}
              </div>
            </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
