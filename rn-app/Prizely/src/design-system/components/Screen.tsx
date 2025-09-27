import { PropsWithChildren } from 'react'
import { View, ViewProps } from 'react-native'
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context'

import { usePrizelyTheme } from '../ThemeProvider'

export const Screen = ({ children, style, ...props }: PropsWithChildren<SafeAreaViewProps>) => {
  const theme = usePrizelyTheme()

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}
      {...props}
    >
      {children}
    </SafeAreaView>
  )
}

export const Surface = ({ children, style, ...props }: PropsWithChildren<ViewProps>) => {
  const theme = usePrizelyTheme()

  return (
    <View
      style={[{ backgroundColor: theme.colors.background }, style]}
      {...props}
    >
      {children}
    </View>
  )
}
