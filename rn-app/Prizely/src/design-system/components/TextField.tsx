import { forwardRef } from 'react'
import { TextInput, TextInputProps } from 'react-native'

import { usePrizelyTheme } from '../ThemeProvider'

export const TextField = forwardRef<TextInput, TextInputProps>((props, ref) => {
  const theme = usePrizelyTheme()

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.colors.mutedForeground}
      style={[
        {
          borderWidth: 1,
          borderColor: theme.colors.input,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.body.fontSize,
          color: theme.colors.foreground,
          backgroundColor: theme.colors.card,
        },
        props.style,
      ]}
      {...props}
    />
  )
})

TextField.displayName = 'TextField'
