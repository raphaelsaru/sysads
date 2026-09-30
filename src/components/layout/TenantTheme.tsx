'use client'

import { useAuth } from '@/contexts/AuthContext'
import { HEX_COLOR_RE, fmtHsl, foregroundFor, hexToHslTriplet, type Hsl } from '@/lib/color'

// Variáveis derivadas da cor primária (primary, ring, accent, chart-1 + foregrounds).
const vars = (c: Hsl) => {
  const v = fmtHsl(c), fg = foregroundFor(c)
  return `--primary:${v};--ring:${v};--accent:${v};--chart-1:${v};--primary-foreground:${fg};--accent-foreground:${fg};`
}

// Sobrescreve as variáveis com a cor da empresa. Sem cor → mantém o padrão do globals.css.
// Vence o globals.css por ser CSS fora de @layer (globals define em @layer base).
// .dark.dark tem especificidade maior que :root:root → modo escuro vence o claro.
export default function TenantTheme() {
  const { tenant } = useAuth()
  const hex = tenant?.branding?.primaryColor
  // Regex evita injeção de CSS via valor salvo
  if (!hex || !HEX_COLOR_RE.test(hex)) return null

  const base = hexToHslTriplet(hex)
  const dark = { ...base, l: Math.min(Math.max(base.l + 10, 45), 75) }

  const css = `:root:root{${vars(base)}}.dark.dark{${vars(dark)}}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
