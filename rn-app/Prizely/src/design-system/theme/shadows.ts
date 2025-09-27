import { Platform } from 'react-native'

const makeShadow = (
  ios: { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number } },
  androidElevation: number,
) => {
  if (Platform.OS === 'android') {
    return {
      elevation: androidElevation,
      shadowColor: ios.shadowColor,
    }
  }

  return ios
}

export const shadows = {
  soft: makeShadow(
    {
      shadowColor: 'rgba(15, 23, 41, 0.12)',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    },
    3,
  ),
  medium: makeShadow(
    {
      shadowColor: 'rgba(15, 23, 41, 0.18)',
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
    },
    6,
  ),
  strong: makeShadow(
    {
      shadowColor: 'rgba(15, 23, 41, 0.22)',
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 14 },
    },
    10,
  ),
} as const

export type ShadowScale = typeof shadows
