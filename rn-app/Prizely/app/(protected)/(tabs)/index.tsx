import { useCallback } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

import { useClientes } from '@hooks/useClientes'
import { useAuth } from '@providers/AuthProvider'
import { formatCurrency } from '@core/utils/currency'
import {
  Screen,
  Typography,
  Card,
  Badge,
  Button,
  FloatingActionButton,
  usePrizelyTheme,
} from '@design-system'

export default function ClientesScreen() {
  const {
    clientes,
    estaCarregandoClientes,
    clientesErro,
    refetchClientes,
  } = useClientes()
  const { signOut, user } = useAuth()
  const theme = usePrizelyTheme()

  const renderItem = useCallback(
    ({ item }: { item: (typeof clientes)[number] }) => {
      const valor = item.valorFechadoNumero ? formatCurrency(item.valorFechadoNumero) : '—'
      return (
        <Card
          style={{ padding: theme.spacing.lg, marginBottom: theme.spacing.md }}
          onPress={() => router.push(`/(protected)/edit-client?id=${item.id}`)}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing.sm,
            }}
          >
            <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
              <Typography variant="titleSm">{item.nome}</Typography>
              <Typography variant="bodySm" tone="muted">
                {item.whatsappInstagram || 'Contato não informado'}
              </Typography>
            </View>
            <Badge variant="outline">{valor}</Badge>
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Typography variant="body" tone="muted">
              Origem: <Typography variant="bodyBold">{item.origem}</Typography>
            </Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Badge
                variant={statusBadgeVariant(item.resultado)}
                style={{ marginRight: theme.spacing.sm }}
              >
                {item.resultado}
              </Badge>
            </View>
          </View>
        </Card>
      )
    },
    [clientes, theme],
  )

  const errorMessage = clientesErro instanceof Error ? clientesErro.message : null

  return (
    <Screen>
      <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl, flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.lg,
          }}
        >
          <View>
            <Typography variant="body" tone="muted">
              Olá,
            </Typography>
            <Typography variant="titleSm">{user?.email}</Typography>
          </View>
          <Button variant="ghost" size="sm" onPress={() => { void signOut() }}>
            Sair
          </Button>
        </View>

        {errorMessage ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
            <Typography variant="bodyBold" tone="destructive">
              Não foi possível carregar seus clientes.
            </Typography>
            <Typography variant="bodySm" tone="muted" style={{ textAlign: 'center' }}>
              {errorMessage}
            </Typography>
            <Button variant="outline" size="sm" onPress={() => refetchClientes()}>
              Tentar novamente
            </Button>
          </Card>
        ) : (
          <FlatList
            data={clientes}
            keyExtractor={(cliente) => cliente.id ?? Math.random().toString()}
            renderItem={renderItem}
            contentContainerStyle={clientes.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
            ListEmptyComponent={
              estaCarregandoClientes ? (
                <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Typography tone="muted">Carregando clientes…</Typography>
                </View>
              ) : (
                <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
                  <Typography variant="titleSm">Nenhum cliente cadastrado ainda</Typography>
                  <Typography variant="bodySm" tone="muted" style={{ textAlign: 'center' }}>
                    Cadastre clientes no painel web ou diretamente pelo app.
                  </Typography>
                  <Button size="sm" onPress={() => router.push('/(protected)/create-client')}>
                    Criar primeiro cliente
                  </Button>
                </Card>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={estaCarregandoClientes}
                onRefresh={() => refetchClientes()}
                tintColor={theme.colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <FloatingActionButton onPress={() => router.push('/(protected)/create-client')}>
        <Ionicons name="add" size={28} color={theme.colors.primaryForeground} />
      </FloatingActionButton>
    </Screen>
  )
}

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'Venda':
      return 'success'
    case 'Orçamento em Processo':
      return 'primary'
    case 'Não Venda':
      return 'destructive'
    default:
      return 'muted'
  }
}
