const defaultCurrency = 'BRL'

export const FALLBACK_CURRENCY_VALUE = defaultCurrency

const currencyFormatters = new Map<string, Intl.NumberFormat>()

export const formatCurrency = (value: number, currency: string = defaultCurrency) => {
  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    )
  }

  return currencyFormatters.get(currency)!.format(value)
}

export const parseCurrencyInput = (input: string | undefined | null): number | null => {
  if (!input) return null

  const sanitized = input
    .replace(/[\sR$]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const parsed = Number(sanitized)
  if (Number.isNaN(parsed)) {
    return null
  }

  return parsed
}
