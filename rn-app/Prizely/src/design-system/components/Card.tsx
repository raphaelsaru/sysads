import { PropsWithChildren } from 'react'
import { View, ViewProps } from 'react-native'

import { usePrizelyTheme } from '../ThemeProvider'

export const Card = ({ style, children, ...props }: PropsWithChildren<ViewProps>) => {
  const theme = usePrizelyTheme()

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          shadowColor: theme.scheme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,41,0.1)',
          shadowOpacity: theme.scheme === 'dark' ? 0.35 : 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: theme.scheme === 'dark' ? 4 : 2,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  )
}

export const CardSection = ({ style, children, ...props }: PropsWithChildren<ViewProps>) => {
  const theme = usePrizelyTheme()

  return (
    <View
      style={[
        {
          marginBottom: theme.spacing.lg,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  )
}
