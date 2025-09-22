'use client'

import * as React from 'react'
import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar as CalendarIcon } from 'lucide-react'

const ISO_DATE_FORMAT = 'yyyy-MM-dd'


// Hook para detectar dispositivos móveis
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkIsMobile = () => {
      // Verificar se estamos no servidor
      if (typeof window === 'undefined') return false
      
      const userAgent = navigator.userAgent || navigator.vendor || (window as { opera?: string }).opera || ''
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const isSmallScreen = window.innerWidth < 768
      
      // Detectar se é um dispositivo móvel real ou tablet
      const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent)
      const isPhone = isMobileDevice && !isTablet
      
      setIsMobile(isPhone || (isTouchDevice && isSmallScreen && !isTablet))
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  return isMobile
}

export interface DateRangePickerProps {
  value?: DateRange
  onChange?: (value: DateRange | undefined) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  align?: React.ComponentProps<typeof PopoverContent>['align']
  sideOffset?: number
  numberOfMonths?: number
  formatLabel?: (value: DateRange | undefined) => string
  icon?: React.ReactNode
  contentClassName?: string
  useNative?: boolean // Nova prop para forçar uso nativo
  fromLabel?: string
  toLabel?: string
  disabled?: boolean
}

function defaultLabel(range: DateRange | undefined) {
  if (range?.from && range?.to) {
    return `${format(range.from, 'dd/MM/yyyy', { locale: ptBR })} – ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`
  }

  if (range?.from) {
    return format(range.from, 'dd/MM/yyyy', { locale: ptBR })
  }

  return 'Selecionar período'
}

export function DateRangePicker({
  value,
  onChange,
  placeholder,
  className,
  buttonClassName,
  align = 'start',
  sideOffset = 8,
  numberOfMonths = 2,
  formatLabel = defaultLabel,
  icon,
  contentClassName,
  useNative = true, // Por padrão, usar input nativo
  fromLabel = 'Data inicial',
  toLabel = 'Data final',
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const shouldUseNative = useNative || isMobile

  const label = value ? formatLabel(value) : placeholder ?? formatLabel(undefined)

  const handleFromChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fromValue = event.target.value
      if (fromValue) {
        // Garantir que a data seja tratada no timezone do Brasil
        const [year, month, day] = fromValue.split('-').map(Number)
        const brazilDate = new Date(year, month - 1, day)
        const fromDate = isValid(brazilDate) ? brazilDate : undefined
        
        onChange?.({
          from: fromDate,
          to: value?.to,
        })
      } else {
        onChange?.({
          from: undefined,
          to: value?.to,
        })
      }
    },
    [onChange, value?.to]
  )

  const handleToChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const toValue = event.target.value
      if (toValue) {
        // Garantir que a data seja tratada no timezone do Brasil
        const [year, month, day] = toValue.split('-').map(Number)
        const brazilDate = new Date(year, month - 1, day)
        const toDate = isValid(brazilDate) ? brazilDate : undefined
        
        onChange?.({
          from: value?.from,
          to: toDate,
        })
      } else {
        onChange?.({
          from: value?.from,
          to: undefined,
        })
      }
    },
    [onChange, value?.from]
  )

  // Usar inputs nativos (padrão para todos os dispositivos)
  if (shouldUseNative) {
    const fromValue = value?.from ? format(value.from, ISO_DATE_FORMAT) : ''
    const toValue = value?.to ? format(value.to, ISO_DATE_FORMAT) : ''
    
    return (
      <div className={className}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date-from" className="text-sm font-medium">
              {fromLabel}
            </Label>
            <div className="relative">
              <Input
                id="date-from"
                type="date"
                value={fromValue}
                onChange={handleFromChange}
                disabled={disabled}
                className={cn(
                  'h-10 w-full',
                  'border border-input bg-background text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  // Removido hover:bg-accent hover:text-accent-foreground
                  !fromValue && 'text-muted-foreground',
                  buttonClassName
                )}
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'textfield',
                  colorScheme: 'light',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  const input = document.getElementById('date-from') as HTMLInputElement
                  if (input && !disabled) {
                    input.showPicker?.()
                  }
                }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="date-to" className="text-sm font-medium">
              {toLabel}
            </Label>
            <div className="relative">
              <Input
                id="date-to"
                type="date"
                value={toValue}
                onChange={handleToChange}
                min={fromValue} // Garantir que a data final não seja anterior à inicial
                disabled={disabled}
                className={cn(
                  'h-10 w-full',
                  'border border-input bg-background text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  // Removido hover:bg-accent hover:text-accent-foreground
                  !toValue && 'text-muted-foreground',
                  buttonClassName
                )}
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'textfield',
                  colorScheme: 'light',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  const input = document.getElementById('date-to') as HTMLInputElement
                  if (input && !disabled) {
                    input.showPicker?.()
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Para desktop, usar o popover com calendar (fallback)
  return (
    <div className={className}>
      <Popover modal={false} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'flex h-10 w-full items-center justify-start gap-2 rounded-md text-left font-medium',
              'border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              (!value?.from || !value?.to) && 'text-muted-foreground',
              buttonClassName
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            {icon ?? <CalendarIcon className="h-4 w-4 text-primary" />}
            <span className="truncate">{label || placeholder || 'Selecionar período'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-[100] w-[min(34rem,calc(100vw-2.5rem))] p-0 sm:w-auto',
            contentClassName
          )}
        >
          <Calendar
            mode="range"
            numberOfMonths={numberOfMonths}
            selected={value}
            onSelect={(range) => onChange?.(range)}
            initialFocus
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
