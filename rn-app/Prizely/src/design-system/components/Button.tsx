import { ActivityIndicator, GestureResponderEvent, Pressable, StyleProp, TextStyle, ViewStyle } from 'react-native'
import { PropsWithChildren, useCallback, useMemo } from 'react'

import { createVariantStyles } from '../utils/createVariantStyles'
import { Typography } from './Typography'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  onPress?: (event: GestureResponderEvent) => void
}

const sizeStyles = createVariantStyles<ButtonSize, Record<ButtonSize, ViewStyle>>((theme) => ({
  sm: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    minHeight: 36,
    borderRadius: theme.radii.sm,
  },
  md: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
    minHeight: 48,
    borderRadius: theme.radii.md,
  },
  lg: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    minHeight: 54,
    borderRadius: theme.radii.lg,
  },
  icon: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    width: 48,
    height: 48,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
}))

const variantStyles = createVariantStyles<ButtonVariant, Record<ButtonVariant, { container: ViewStyle; text: TextStyle }>>(
  (theme) => ({
    primary: {
      container: {
        backgroundColor: theme.colors.primary,
        borderWidth: 0,
      },
      text: {
        color: theme.colors.primaryForeground,
      },
    },
    secondary: {
      container: {
        backgroundColor: theme.colors.secondary,
        borderWidth: 0,
      },
      text: {
        color: theme.colors.secondaryForeground,
      },
    },
    outline: {
      container: {
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      text: {
        color: theme.colors.foreground,
      },
    },
    ghost: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
      text: {
        color: theme.colors.foreground,
      },
    },
    destructive: {
      container: {
        backgroundColor: theme.colors.destructive,
        borderWidth: 0,
      },
      text: {
        color: theme.colors.destructiveForeground,
      },
    },
  }),
)

export const Button = ({
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  children,
  fullWidth,
  style,
  textStyle,
  onPress,
}: PropsWithChildren<ButtonProps>) => {
  const { styles: sizeStyle } = sizeStyles(size)
  const { styles: variantStyle } = variantStyles(variant)

  const baseStyle = useMemo<ViewStyle>(
    () => ({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    [],
  )

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled || loading) return
      onPress?.(event)
    },
    [disabled, loading, onPress],
  )

  const content = loading ? (
    <ActivityIndicator color={variantStyle.text.color} />
  ) : (
    <Typography
      variant={size === 'sm' ? 'bodySm' : 'bodyBold'}
      style={[{ color: variantStyle.text.color }, textStyle]}
    >
      {children}
    </Typography>
  )

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        baseStyle,
        sizeStyle,
        variantStyle.container,
        fullWidth ? { alignSelf: 'stretch' } : null,
        disabled ? { opacity: 0.6 } : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  )
}
