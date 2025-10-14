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
 * O valor digitado é tratado como reais inteiros (sem centavos)
 * Exemplo: digitar "500" resulta em "500,00" (quinhentos reais)
 * @param value - Valor apenas com números (sem formatação)
 * @returns Valor formatado como string
 */
export const formatCurrencyInput = (value: string): string => {
  // Value já deve vir apenas com números
  if (!value || value === '0') return ''

  // Converte para número inteiro
  const amount = Number(value)

  // Verifica se é um número válido
  if (Number.isNaN(amount) || amount === 0) return ''

  // Formata para moeda brasileira com centavos zerados
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + ',00'
}
