'use client'

import * as React from 'react'
import { format, isValid, parse, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { formatDateBR, getTodayBR } from '@/lib/dateUtils'

const ISO_DATE_FORMAT = 'yyyy-MM-dd'
const BR_DATE_FORMAT = 'dd/MM/yyyy'

function coerceDate(value?: string | Date | null) {
  if (!value) return undefined

  if (value instanceof Date) {
    return isValid(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined

    try {
      // Se é uma data ISO (YYYY-MM-DD), criar no timezone do Brasil
      if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Criar a data considerando o timezone do Brasil
        const [year, month, day] = trimmed.split('-').map(Number)
        const brazilDate = new Date(year, month - 1, day)
        return isValid(brazilDate) ? brazilDate : undefined
      }

      const isoCandidate = parseISO(trimmed)
      if (isValid(isoCandidate)) return isoCandidate
    } catch (error) {
      // noop — try fallback parsing below
    }

    const brCandidate = parse(trimmed, BR_DATE_FORMAT, new Date())
    if (isValid(brCandidate)) return brCandidate

    const generic = new Date(trimmed)
    return isValid(generic) ? generic : undefined
  }

  return undefined
}

export interface DatePickerProps {
  id?: string
  value?: string | Date | null
  onChange?: (value: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  buttonClassName?: string
  align?: React.ComponentProps<typeof PopoverContent>['align']
  sideOffset?: number
  contentClassName?: string
  forceNative?: boolean
  useNative?: boolean // Nova prop para forçar uso nativo
}

// Hook para detectar dispositivos móveis
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkIsMobile = () => {
      // Verificar se estamos no servidor
      if (typeof window === 'undefined') return false
      
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
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

export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  className,
  buttonClassName,
  align = 'start',
  sideOffset = 8,
  contentClassName,
  forceNative = false,
  useNative = true, // Por padrão, usar input nativo
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const shouldUseNative = useNative || forceNative || isMobile

  const selectedDate = React.useMemo(() => coerceDate(value), [value])
  const label = selectedDate
    ? formatDateBR(selectedDate) // Usar função do timezone do Brasil
    : placeholder ?? 'Selecione uma data'

  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      if (!date) {
        onChange?.(undefined)
        return
      }

      onChange?.(format(date, ISO_DATE_FORMAT))
      setOpen(false)
    },
    [onChange]
  )

  const handleNativeChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      if (value) {
        // Garantir que a data seja tratada no timezone do Brasil
        const [year, month, day] = value.split('-').map(Number)
        const brazilDate = new Date(year, month - 1, day)
        const isoString = brazilDate.toISOString().split('T')[0]
        onChange?.(isoString)
      } else {
        onChange?.(undefined)
      }
    },
    [onChange]
  )

  // Usar input nativo (padrão para todos os dispositivos)
  if (shouldUseNative) {
    // Garantir que o valor seja exibido corretamente no timezone do Brasil
    const inputValue = selectedDate ? format(selectedDate, ISO_DATE_FORMAT) : ''
    
    return (
      <div className={className}>
        <div className="relative">
          <Input
            id={id}
            type="date"
            value={inputValue}
            onChange={handleNativeChange}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            className={cn(
              'h-10 w-full',
              'border border-input bg-background text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              // Removido hover:bg-accent hover:text-accent-foreground
              !inputValue && 'text-muted-foreground',
              buttonClassName
            )}
            style={{
              // Garantir que o input de data seja visível e funcional
              WebkitAppearance: 'none',
              MozAppearance: 'textfield',
              colorScheme: 'light', // Força tema claro para melhor visibilidade
              cursor: 'pointer', // Mostrar que é clicável
            }}
            onClick={() => {
              // Abrir o seletor de data ao clicar em qualquer área do input
              const input = document.getElementById(id || '') as HTMLInputElement
              if (input && !disabled) {
                input.showPicker?.()
              }
            }}
          />
        </div>
      </div>
    )
  }

  // Para desktop, usar o popover com calendar
  return (
    <div className={className}>
      <Popover modal={false} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center justify-start gap-2 rounded-md text-left font-normal',
              'border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              !selectedDate && 'text-muted-foreground',
              buttonClassName
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-required={required}
          >
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-[100] w-[min(22rem,calc(100vw-2.5rem))] p-0 sm:w-auto',
            contentClassName
          )}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={handleSelect}
            initialFocus
            locale={ptBR}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
