import { useMemo } from 'react'

import { Theme } from '../theme'
import { usePrizelyTheme } from '../ThemeProvider'

type VariantFactory<RecordShape> = (theme: Theme) => RecordShape

export const createVariantStyles = <VariantKey extends string, RecordShape extends Record<VariantKey, any>>(
  factory: VariantFactory<RecordShape>,
) => {
  return (variant: VariantKey) => {
    const theme = usePrizelyTheme()

    const styles = useMemo(() => factory(theme), [theme])

    return { styles: styles[variant], theme }
  }
}
