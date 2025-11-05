import type { UserProfile } from '@/contexts/AuthContext'

export type SupportedCurrency = NonNullable<UserProfile['currency']>

const FALLBACK_CURRENCY: SupportedCurrency = 'BRL'

const currencyPrefixes: Record<SupportedCurrency, string> = {
  BRL: 'R$ ',
  USD: 'US$ ',
  EUR: '€ ',
}

interface FormatOptions {
  fallback?: string
}

export function formatCurrency(
  value: number | null | undefined,
  currency: SupportedCurrency = FALLBACK_CURRENCY,
  options: FormatOptions = {}
): string {
  const { fallback = '' } = options

  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback
  }

  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value))
  } catch (error) {
    console.error('Erro ao formatar valor monetário:', error)
    return fallback
  }
}

export function parseCurrencyInput(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const raw = value
    .toString()
    .trim()

  if (!raw) return null

  const sanitized = raw
    .replace(/\s+/g, '')
    .replace(/[^0-9,.-]/g, '')

  if (!sanitized) return null

  // Consider formato pt-BR: remove pontos de milhar e usa vírgula como decimal
  const normalized = sanitized
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function getCurrencyPrefix(currency: SupportedCurrency = FALLBACK_CURRENCY): string {
  return currencyPrefixes[currency] ?? currencyPrefixes[FALLBACK_CURRENCY]
}

export const FALLBACK_CURRENCY_VALUE = FALLBACK_CURRENCY
