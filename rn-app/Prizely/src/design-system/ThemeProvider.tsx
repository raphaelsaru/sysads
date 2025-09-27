import { PropsWithChildren, createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { Theme, darkTheme, lightTheme } from './theme'

const ThemeContext = createContext<Theme>(lightTheme)

export const PrizelyThemeProvider = ({ children }: PropsWithChildren) => {
  const scheme = useColorScheme()

  const value = useMemo(() => {
    if (scheme === 'dark') {
      return darkTheme
    }
    return lightTheme
  }, [scheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const usePrizelyTheme = () => useContext(ThemeContext)
