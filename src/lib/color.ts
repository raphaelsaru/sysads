export type Hsl = { h: number; s: number; l: number }

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

// "#RRGGBB" -> { h, s, l } (formato das CSS vars do Tailwind em globals.css)
export function hexToHslTriplet(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export const fmtHsl = ({ h, s, l }: Hsl) => `${h} ${s}% ${l}%`

// Texto sobre a cor: escuro se a cor for clara.
export const foregroundFor = (l: number) => (l > 60 ? '40 20% 9%' : '38 40% 97%')
