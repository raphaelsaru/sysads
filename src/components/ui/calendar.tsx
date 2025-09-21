'use client'

import { DateRange, DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'grid gap-4 sm:flex sm:items-start',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium text-foreground',
        nav: 'space-x-1 flex items-center',
        button_previous: 'absolute left-1 text-muted-foreground hover:text-foreground',
        button_next: 'absolute right-1 text-muted-foreground hover:text-foreground',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'h-8 w-8 font-normal text-xs text-muted-foreground',
        row: 'flex w-full mt-2',
        cell: 'h-8 w-8 text-center text-sm relative [&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-full',
        day: cn(
          'h-8 w-8 aria-selected:opacity-100 rounded-full text-sm transition-colors',
          'hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
        ),
        day_disabled: 'opacity-40 pointer-events-none',
        day_outside: 'text-muted-foreground/60',
        day_selected: 'bg-primary text-primary-foreground hover:bg-primary focus:bg-primary',
        day_today: 'font-semibold text-primary',
        ...classNames,
      }}
      {...props}
    />
  )
}

Calendar.displayName = 'Calendar'

export { Calendar, type DateRange }
