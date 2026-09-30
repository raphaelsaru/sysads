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

// { h, s, l } -> [r, g, b] em 0..1
export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const S = s / 100, L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)]
}

// Luminância relativa WCAG (sRGB linearizado)
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// Texto sobre a cor: escuro se a cor for clara (luminância > 0.4).
export const foregroundFor = (hsl: Hsl) =>
  relativeLuminance(hslToRgb(hsl)) > 0.4 ? '40 20% 9%' : '38 40% 97%'
