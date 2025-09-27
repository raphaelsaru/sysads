import { PropsWithChildren } from 'react'
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  ViewStyle,
} from 'react-native'

import { usePrizelyTheme } from '../ThemeProvider'

export const FloatingActionButton = ({ style, children, ...props }: PropsWithChildren<PressableProps>) => {
  const theme = usePrizelyTheme()

  const baseStyle: ViewStyle = {
    position: 'absolute',
    right: theme.spacing.xl,
    bottom: theme.spacing['2xl'],
    width: 56,
    height: 56,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.scheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(15,23,41,0.2)',
    shadowOpacity: theme.scheme === 'dark' ? 0.5 : 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  }

  const resolveStyle = (state: PressableStateCallbackType): StyleProp<ViewStyle> => {
    const external = typeof style === 'function' ? style(state) : style
    const pressedStyle: ViewStyle | undefined = state.pressed
      ? {
          transform: [{ scale: 0.97 }],
        }
      : undefined

    return [baseStyle, pressedStyle, external]
  }

  return (
    <Pressable style={resolveStyle} {...props}>
      {children}
    </Pressable>
  )
}
