import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useAuth } from '@providers/AuthProvider'

export default function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="create-client"
        options={{
          title: 'Novo cliente',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="edit-client"
        options={{
          title: 'Editar cliente',
          presentation: 'modal',
        }}
      />
    </Stack>
  )
}
