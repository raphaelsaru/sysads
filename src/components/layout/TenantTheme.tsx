'use client'

import { useAuth } from '@/contexts/AuthContext'
import { HEX_COLOR_RE, fmtHsl, foregroundFor, hexToHslTriplet } from '@/lib/color'

// Sobrescreve --primary/--ring com a cor da empresa. Sem cor → mantém o padrão do globals.css.
// Seletores duplicados (:root:root / .dark.dark) garantem prioridade sobre globals.css
// independente da ordem no documento; .dark.dark vem depois pra vencer :root:root no modo escuro.
export default function TenantTheme() {
  const { tenant } = useAuth()
  const hex = tenant?.branding?.primaryColor
  // Regex evita injeção de CSS via valor salvo
  if (!hex || !HEX_COLOR_RE.test(hex)) return null

  const base = hexToHslTriplet(hex)
  const dark = { ...base, l: Math.min(base.l + 10, 75) }

  const css =
    `:root:root{--primary:${fmtHsl(base)};--ring:${fmtHsl(base)};--primary-foreground:${foregroundFor(base.l)};}` +
    `.dark.dark{--primary:${fmtHsl(dark)};--ring:${fmtHsl(dark)};--primary-foreground:${foregroundFor(dark.l)};}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
