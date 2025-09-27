import { PropsWithChildren } from 'react'
import { Pressable, View, ViewProps } from 'react-native'

import { Typography } from './Typography'
import { usePrizelyTheme } from '../ThemeProvider'

export interface ChipOption<T extends string> {
  label: string
  value: T
}

export interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[]
  value: T
  onChange: (value: T) => void
  style?: ViewProps['style']
}

export const ChipGroup = <T extends string>({ options, value, onChange, style }: ChipGroupProps<T>) => {
  const theme = usePrizelyTheme()

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -theme.spacing.xs,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              marginHorizontal: theme.spacing.xs,
              marginVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radii.pill,
              borderWidth: active ? 0 : 1,
              borderColor: active ? theme.colors.primary : theme.colors.border,
              backgroundColor: active ? theme.colors.primary : theme.colors.card,
            }}
          >
            <Typography
              variant="bodySm"
              style={{
                color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                fontWeight: active ? '600' : '500',
              }}
            >
              {option.label}
            </Typography>
          </Pressable>
        )
      })}
    </View>
  )
}
