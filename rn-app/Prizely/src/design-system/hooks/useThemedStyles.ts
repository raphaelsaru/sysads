import { useMemo } from 'react'
import { StyleSheet } from 'react-native'

import { Theme } from '../theme'
import { usePrizelyTheme } from '../ThemeProvider'

type StyleFactory<T> = (theme: Theme) => T

export const createStyleFactory = <T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: StyleFactory<T>,
) => factory

export const useThemedStyles = <T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: StyleFactory<T>,
) => {
  const theme = usePrizelyTheme()

  const styles = useMemo(() => StyleSheet.create(factory(theme)), [factory, theme])

  return { styles, theme }
}
