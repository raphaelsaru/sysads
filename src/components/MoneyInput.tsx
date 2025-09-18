'use client'

import { NumericFormat } from 'react-number-format'

import { cn } from '@/lib/utils'

interface MoneyInputProps {
  value?: string | number
  onChangeValue?: (value: number | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  name?: string
}

const baseInputStyles =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

export default function MoneyInput({
  value,
  onChangeValue,
  placeholder = 'R$ 0,00',
  className,
  disabled = false,
  id,
  name,
}: MoneyInputProps) {
  return (
    <NumericFormat
      id={id}
      name={name}
      className={cn(baseInputStyles, className)}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onValueChange={(values) => {
        const { floatValue } = values
        onChangeValue?.(floatValue)
      }}
      thousandSeparator="."
      decimalSeparator="," 
      decimalScale={2}
      fixedDecimalScale={true}
      prefix="R$ "
      allowNegative={false}
      allowLeadingZeros={false}
      inputMode="decimal"
    />
  )
}
