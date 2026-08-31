'use client'

import { useMemo } from 'react'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { CalendarEvent, MonthCount } from '@/hooks/useGoogleCalendarEvents'

interface ResumoMensalProps {
  currentMonthEvents: CalendarEvent[]
  currentMonth: Date
  monthCounts: MonthCount[]
  onWindowShift: (direction: -1 | 1) => void
}

function formatMonthLabel(monthKey: string): string {
  const date = parse(monthKey, 'yyyy-MM', new Date())
  return format(date, 'MMM/yyyy', { locale: ptBR })
}

export default function ResumoMensal({ currentMonthEvents, currentMonth, monthCounts, onWindowShift }: ResumoMensalProps) {
  const diaMaisCheio = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of currentMonthEvents) {
      const dateKey = event.start.slice(0, 10)
      map.set(dateKey, (map.get(dateKey) ?? 0) + 1)
    }
    let best: { date: string; count: number } | null = null
    for (const [date, count] of map.entries()) {
      if (!best || count > best.count) best = { date, count }
    }
    return best
  }, [currentMonthEvents])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70 bg-card/70 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total em {format(currentMonth, 'MMMM', { locale: ptBR })}
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonthEvents.length}</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dia mais cheio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {diaMaisCheio ? (
              <div className="text-2xl font-bold">
                {format(new Date(diaMaisCheio.date), 'dd/MM')}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({diaMaisCheio.count} {diaMaisCheio.count === 1 ? 'evento' : 'eventos'})
                </span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem eventos no mês</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Resumo por mês</CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => onWindowShift(-1)} aria-label="Janela anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onWindowShift(1)} aria-label="Próxima janela">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Eventos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthCounts.map((mc) => (
                <TableRow key={mc.month}>
                  <TableCell className="capitalize">{formatMonthLabel(mc.month)}</TableCell>
                  <TableCell className="text-right">{mc.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
