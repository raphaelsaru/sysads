import { lightColors, darkColors, type Palette } from './palette'
import { spacing, type SpacingScale } from './spacing'
import { typography, type TypographyScale } from './typography'
import { radii, type RadiusScale } from './radius'
import { shadows, type ShadowScale } from './shadows'

export type Theme = {
  colors: Palette
  spacing: SpacingScale
  typography: TypographyScale
  radii: RadiusScale
  shadows: ShadowScale
  scheme: 'light' | 'dark'
}

export const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  typography,
  radii,
  shadows,
  scheme: 'light',
}

export const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  typography,
  radii,
  shadows,
  scheme: 'dark',
}
