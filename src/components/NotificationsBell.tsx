'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/hooks/useNotifications'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export default function NotificationsBell() {
  const { notifications, loading, totalCount } = useNotifications()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const handleEditLead = (leadId: string) => {
    setOpen(false) // Fechar dropdown antes de navegar
    router.push(`/?edit=${leadId}`)
  }

  const hasNotifications = totalCount > 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'relative border-border/70 bg-background/60 backdrop-blur',
            hasNotifications && 'animate-pulse'
          )}
          aria-label="Notificações de leads"
        >
          <Bell className={cn('h-5 w-5', hasNotifications && 'text-primary')} />
          {hasNotifications && (
            <Badge
              variant="destructive"
              className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none"
            >
              {totalCount > 99 ? '99+' : totalCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Leads para chamar</span>
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {totalCount}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="px-2 py-8 text-center text-sm text-muted-foreground">
            Carregando notificações...
          </div>
        ) : totalCount === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-muted-foreground">
            Nenhuma lead agendada para os próximos 3 dias
          </div>
        ) : (
          <>
            {/* Hoje */}
            {notifications.hoje.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-semibold uppercase text-destructive">
                  Hoje ({notifications.hoje.length})
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {notifications.hoje.map((lead) => (
                    <DropdownMenuItem
                      key={lead.id}
                      className="cursor-pointer flex-col items-start gap-1 py-2"
                      onClick={() => handleEditLead(lead.id)}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-foreground">{lead.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {lead.resultado}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {lead.whatsappInstagram}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Amanhã */}
            {notifications.amanha.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-semibold uppercase text-orange-500">
                  Amanhã ({notifications.amanha.length})
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {notifications.amanha.map((lead) => (
                    <DropdownMenuItem
                      key={lead.id}
                      className="cursor-pointer flex-col items-start gap-1 py-2"
                      onClick={() => handleEditLead(lead.id)}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-foreground">{lead.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {lead.resultado}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {lead.whatsappInstagram}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Próximos dias */}
            {notifications.proximos.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-semibold uppercase text-primary">
                  Próximos dias ({notifications.proximos.length})
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {notifications.proximos.map((lead) => (
                    <DropdownMenuItem
                      key={lead.id}
                      className="cursor-pointer flex-col items-start gap-1 py-2"
                      onClick={() => handleEditLead(lead.id)}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-foreground">{lead.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(lead.dataLembrete)}
                        </span>
                      </div>
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {lead.whatsappInstagram}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {lead.resultado}
                        </Badge>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

