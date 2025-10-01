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

/**
 * Formata o valor digitado para o padrão de moeda brasileira (0.000,00)
 * @param value - Valor digitado pelo usuário
 * @returns Valor formatado como string
 */
export const formatCurrencyInput = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '')

  if (!numbers) return ''

  // Converte para centavos
  const amount = Number(numbers) / 100

  // Formata para moeda brasileira
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
