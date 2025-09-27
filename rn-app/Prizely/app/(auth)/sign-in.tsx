import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native'
import { router } from 'expo-router'

import { useAuth } from '@providers/AuthProvider'
import { Screen, Card, Typography, TextField, Button, usePrizelyTheme } from '@design-system'

export default function SignInScreen() {
  const { signIn, loading, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(protected)/(tabs)')
    }
  }, [loading, user])

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Preencha e-mail e senha')
      return
    }

    setSubmitting(true)
    const result = await signIn(email.trim(), password)

    if (result.error) {
      Alert.alert('Não foi possível acessar', result.error)
    }

    setSubmitting(false)
  }

  if (loading && !user) {
    return null
  }

  const theme = usePrizelyTheme()

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 96,
            gap: theme.spacing['2xl'],
          }}
        >
          <View style={{ gap: theme.spacing.sm }}>
            <Typography variant="titleLg">
              Prizely CRM
            </Typography>
            <Typography variant="body" tone="muted">
              Acesse sua base de clientes em qualquer lugar.
            </Typography>
          </View>

          <Card style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.xs }}>
              <Typography variant="bodyBold">E-mail</Typography>
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder="voce@empresa.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <Typography variant="bodyBold">Senha</Typography>
              <TextField
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            </View>

            <Button onPress={handleSubmit} loading={submitting} fullWidth>
              Entrar
            </Button>
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}
