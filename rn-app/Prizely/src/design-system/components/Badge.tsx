import { PropsWithChildren } from 'react'
import { View, ViewProps } from 'react-native'

import { Typography } from './Typography'
import { usePrizelyTheme } from '../ThemeProvider'

export type BadgeVariant = 'primary' | 'secondary' | 'outline' | 'muted' | 'success' | 'warning' | 'destructive'

export const Badge = ({ variant = 'primary', style, children, ...props }: PropsWithChildren<ViewProps & { variant?: BadgeVariant }>) => {
  const theme = usePrizelyTheme()

  const { backgroundColor, color, borderColor, borderWidth } = (() => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: theme.colors.secondary,
          color: theme.colors.secondaryForeground,
          borderColor: theme.colors.secondary,
          borderWidth: 0,
        }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: theme.colors.foreground,
          borderColor: theme.colors.border,
          borderWidth: 1,
        }
      case 'muted':
        return {
          backgroundColor: theme.colors.muted,
          color: theme.colors.mutedForeground,
          borderColor: theme.colors.muted,
          borderWidth: 0,
        }
      case 'success':
        return {
          backgroundColor: theme.colors.success,
          color: theme.colors.successForeground,
          borderColor: theme.colors.success,
          borderWidth: 0,
        }
      case 'warning':
        return {
          backgroundColor: theme.colors.warning,
          color: theme.colors.warningForeground,
          borderColor: theme.colors.warning,
          borderWidth: 0,
        }
      case 'destructive':
        return {
          backgroundColor: theme.colors.destructive,
          color: theme.colors.destructiveForeground,
          borderColor: theme.colors.destructive,
          borderWidth: 0,
        }
      default:
        return {
          backgroundColor: theme.colors.primary,
          color: theme.colors.primaryForeground,
          borderColor: theme.colors.primary,
          borderWidth: 0,
        }
    }
  })()

  return (
    <View
      style={[
        {
          backgroundColor,
          borderColor,
          borderWidth,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radii.pill,
          alignSelf: 'flex-start',
        },
        style,
      ]}
      {...props}
    >
      <Typography variant="bodySm" style={{ color, fontWeight: '600' }}>
        {children}
      </Typography>
    </View>
  )
}
