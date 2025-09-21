'use client'

import { NumericFormat } from 'react-number-format'

import { cn } from '@/lib/utils'
import { FALLBACK_CURRENCY_VALUE, getCurrencyPrefix, type SupportedCurrency } from '@/lib/currency'

interface MoneyInputProps {
  value?: string | number
  onChangeValue?: (value: number | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  name?: string
  currency?: SupportedCurrency
}

const baseInputStyles =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

export default function MoneyInput({
  value,
  onChangeValue,
  placeholder,
  className,
  disabled = false,
  id,
  name,
  currency = FALLBACK_CURRENCY_VALUE,
}: MoneyInputProps) {
  const prefix = getCurrencyPrefix(currency)
  const resolvedPlaceholder = placeholder ?? `${prefix}0,00`

  return (
    <NumericFormat
      id={id}
      name={name}
      className={cn(baseInputStyles, className)}
      placeholder={resolvedPlaceholder}
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
      prefix={prefix}
      allowNegative={false}
      allowLeadingZeros={false}
      inputMode="decimal"
    />
  )
}
