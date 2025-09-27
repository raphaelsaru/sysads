import { PropsWithChildren, useState } from 'react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'

// Atualiza o foco do React Query conforme estado do app
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        handleFocus(true)
      }
    })

    return () => subscription.remove()
  })
}

export const QueryProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(() => new QueryClient())

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
