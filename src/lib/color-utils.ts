/**
 * Utilitários para conversão e manipulação de cores
 * Usado para o sistema de temas white label
 */

/**
 * Converte uma cor HEX para valores RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove o # se existir
  const cleanHex = hex.replace('#', '')
  
  // Valida o formato
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    console.warn(`Formato de cor inválido: ${hex}`)
    return null
  }
  
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  
  return { r, g, b }
}

/**
 * Converte RGB para HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Converte HEX diretamente para HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  
  return rgbToHsl(rgb.r, rgb.g, rgb.b)
}

/**
 * Gera uma cor mais clara
 */
export function lightenColor(hex: string, amount: number = 10): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  
  const newL = Math.min(100, hsl.l + amount)
  return `hsl(${hsl.h}, ${hsl.s}%, ${newL}%)`
}

/**
 * Gera uma cor mais escura
 */
export function darkenColor(hex: string, amount: number = 10): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  
  const newL = Math.max(0, hsl.l - amount)
  return `hsl(${hsl.h}, ${hsl.s}%, ${newL}%)`
}

/**
 * Gera variações de uma cor para diferentes estados (hover, active, etc)
 */
export function generateColorVariations(hex: string) {
  const hsl = hexToHsl(hex)
  if (!hsl) {
    return {
      base: hex,
      hover: hex,
      active: hex,
      light: hex,
      lighter: hex,
      dark: hex,
      darker: hex,
    }
  }
  
  return {
    base: `${hsl.h} ${hsl.s}% ${hsl.l}%`,
    hover: `${hsl.h} ${hsl.s}% ${Math.max(0, hsl.l - 5)}%`,
    active: `${hsl.h} ${hsl.s}% ${Math.max(0, hsl.l - 10)}%`,
    light: `${hsl.h} ${hsl.s}% ${Math.min(100, hsl.l + 10)}%`,
    lighter: `${hsl.h} ${hsl.s}% ${Math.min(100, hsl.l + 20)}%`,
    dark: `${hsl.h} ${hsl.s}% ${Math.max(0, hsl.l - 10)}%`,
    darker: `${hsl.h} ${hsl.s}% ${Math.max(0, hsl.l - 20)}%`,
  }
}

/**
 * Aplica cores do tenant como CSS variables no documento
 */
export function applyTenantColors(primaryColor: string, secondaryColor: string): void {
  const root = document.documentElement
  
  // Gerar variações da cor primária
  const primaryVariations = generateColorVariations(primaryColor)
  const secondaryVariations = generateColorVariations(secondaryColor)
  
  // Aplicar variáveis CSS
  root.style.setProperty('--color-tenant-primary', primaryVariations.base)
  root.style.setProperty('--color-tenant-primary-hover', primaryVariations.hover)
  root.style.setProperty('--color-tenant-primary-active', primaryVariations.active)
  root.style.setProperty('--color-tenant-primary-light', primaryVariations.light)
  root.style.setProperty('--color-tenant-primary-lighter', primaryVariations.lighter)
  root.style.setProperty('--color-tenant-primary-dark', primaryVariations.dark)
  root.style.setProperty('--color-tenant-primary-darker', primaryVariations.darker)
  
  root.style.setProperty('--color-tenant-secondary', secondaryVariations.base)
  root.style.setProperty('--color-tenant-secondary-hover', secondaryVariations.hover)
  root.style.setProperty('--color-tenant-secondary-active', secondaryVariations.active)
  root.style.setProperty('--color-tenant-secondary-light', secondaryVariations.light)
  root.style.setProperty('--color-tenant-secondary-lighter', secondaryVariations.lighter)
  root.style.setProperty('--color-tenant-secondary-dark', secondaryVariations.dark)
  root.style.setProperty('--color-tenant-secondary-darker', secondaryVariations.darker)
  
  // Sobrescrever a cor primária do tema com a cor do tenant
  root.style.setProperty('--primary', primaryVariations.base)
  
  console.log('🎨 Cores do tenant aplicadas:', { primaryColor, secondaryColor })
}

/**
 * Remove cores customizadas do tenant (volta para o padrão)
 */
export function resetTenantColors(): void {
  const root = document.documentElement
  
  const customProperties = [
    '--color-tenant-primary',
    '--color-tenant-primary-hover',
    '--color-tenant-primary-active',
    '--color-tenant-primary-light',
    '--color-tenant-primary-lighter',
    '--color-tenant-primary-dark',
    '--color-tenant-primary-darker',
    '--color-tenant-secondary',
    '--color-tenant-secondary-hover',
    '--color-tenant-secondary-active',
    '--color-tenant-secondary-light',
    '--color-tenant-secondary-lighter',
    '--color-tenant-secondary-dark',
    '--color-tenant-secondary-darker',
  ]
  
  customProperties.forEach((prop) => {
    root.style.removeProperty(prop)
  })
  
  console.log('🎨 Cores do tenant resetadas para o padrão')
}

/**
 * Valida se uma string é uma cor HEX válida
 */
export function isValidHexColor(hex: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(hex)
}

/**
 * Normaliza uma cor HEX (adiciona # se necessário)
 */
export function normalizeHexColor(hex: string): string {
  const clean = hex.replace('#', '')
  return `#${clean}`
}

/**
 * Gera uma cor aleatória em HEX
 */
export function generateRandomHexColor(): string {
  const letters = '0123456789ABCDEF'
  let color = '#'
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

/**
 * Calcula o contraste entre duas cores (útil para acessibilidade)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  
  if (!rgb1 || !rgb2) return 0
  
  const luminance = (rgb: { r: number; g: number; b: number }) => {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
      val /= 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  
  const lum1 = luminance(rgb1)
  const lum2 = luminance(rgb2)
  
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  
  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Verifica se uma cor tem contraste suficiente para texto
 */
export function hasGoodContrast(backgroundColor: string, textColor: string): boolean {
  const ratio = getContrastRatio(backgroundColor, textColor)
  // WCAG AA requer pelo menos 4.5:1 para texto normal
  return ratio >= 4.5
}







