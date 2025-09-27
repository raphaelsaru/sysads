import { View } from 'react-native'

import { useClientes } from '@hooks/useClientes'
import { formatCurrency } from '@core/utils/currency'
import { Screen, Typography, Card, usePrizelyTheme } from '@design-system'

export default function DashboardScreen() {
  const { estatisticas, estaCarregandoEstatisticas } = useClientes()
  const theme = usePrizelyTheme()

  const resumo = estatisticas ?? {
    total: 0,
    vendas: 0,
    emProcesso: 0,
    naoVenda: 0,
    valorEmProcesso: 0,
    valorVendido: 0,
  }

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
        <Typography variant="titleMd" style={{ marginBottom: theme.spacing.md }}>
          Resumo rápido
        </Typography>

        {estaCarregandoEstatisticas ? (
          <Typography tone="muted">Carregando métricas…</Typography>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <MetricCard label="Total de clientes" value={String(resumo.total)} />
            <MetricCard label="Vendas" value={String(resumo.vendas)} tone="success" />
            <MetricCard label="Em processo" value={String(resumo.emProcesso)} tone="primary" />
            <MetricCard label="Não venda" value={String(resumo.naoVenda)} tone="destructive" />
            <MetricCard label="Valor vendido" value={formatCurrency(resumo.valorVendido)} />
            <MetricCard label="Valor em negociação" value={formatCurrency(resumo.valorEmProcesso)} />
          </View>
        )}
      </View>
    </Screen>
  )
}

const MetricCard = ({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'primary' | 'destructive' }) => {
  const theme = usePrizelyTheme()

  return (
    <Card
      style={{
        width: '47%',
        padding: theme.spacing.lg,
        gap: theme.spacing.xs,
      }}
    >
      <Typography variant="bodySm" tone="muted">
        {label}
      </Typography>
      <Typography variant="titleSm" tone={tone ?? 'default'}>
        {value}
      </Typography>
    </Card>
  )
}
