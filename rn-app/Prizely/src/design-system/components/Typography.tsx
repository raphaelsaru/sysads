import { PropsWithChildren } from 'react'
import { Text, TextProps, TextStyle } from 'react-native'

import { useThemedStyles } from '../hooks/useThemedStyles'
import { createVariantStyles } from '../utils/createVariantStyles'

export type TypographyVariant =
  | 'display'
  | 'titleLg'
  | 'titleMd'
  | 'titleSm'
  | 'body'
  | 'bodyBold'
  | 'bodySm'
  | 'caption'

const useTypographyStyles = createVariantStyles<
  TypographyVariant,
  Record<TypographyVariant, TextStyle>
>((theme) => ({
  display: {
    ...theme.typography.display,
    color: theme.colors.foreground,
  },
  titleLg: {
    ...theme.typography.titleLg,
    color: theme.colors.foreground,
  },
  titleMd: {
    ...theme.typography.titleMd,
    color: theme.colors.foreground,
  },
  titleSm: {
    ...theme.typography.titleSm,
    color: theme.colors.foreground,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  bodyBold: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  bodySm: {
    ...theme.typography.bodySm,
    color: theme.colors.mutedForeground,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textTransform: 'uppercase',
  },
}))

export interface TypographyProps extends TextProps {
  variant?: TypographyVariant
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'destructive' | 'primary'
}

export const Typography = ({ variant = 'body', tone = 'default', style, children, ...props }: PropsWithChildren<TypographyProps>) => {
  const { styles, theme } = useTypographyStyles(variant)

  const toneColor = (() => {
    switch (tone) {
      case 'muted':
        return theme.colors.mutedForeground
      case 'success':
        return theme.colors.success
      case 'warning':
        return theme.colors.warning
      case 'destructive':
        return theme.colors.destructive
      case 'primary':
        return theme.colors.primary
      default:
        return (styles as any).color ?? theme.colors.foreground
    }
  })()

  return (
    <Text style={[styles, { color: toneColor }, style]} {...props}>
      {children}
    </Text>
  )
}
