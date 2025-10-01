import { Switch as RNSwitch, SwitchProps as RNSwitchProps, View } from 'react-native'

import { Typography } from './Typography'
import { usePrizelyTheme } from '../ThemeProvider'

export interface SwitchProps extends Omit<RNSwitchProps, 'value' | 'onValueChange'> {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
}

export const Switch = ({ value, onValueChange, label, ...props }: SwitchProps) => {
  const theme = usePrizelyTheme()

  if (!label) {
    return (
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: theme.colors.muted,
          true: theme.colors.primary,
        }}
        thumbColor={value ? theme.colors.primaryForeground : theme.colors.mutedForeground}
        ios_backgroundColor={theme.colors.muted}
        {...props}
      />
    )
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: theme.colors.muted,
          true: theme.colors.primary,
        }}
        thumbColor={value ? theme.colors.primaryForeground : theme.colors.mutedForeground}
        ios_backgroundColor={theme.colors.muted}
        {...props}
      />
      <Typography variant="body">{label}</Typography>
    </View>
  )
}
