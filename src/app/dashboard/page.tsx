'use client'

import { Users, ShoppingBag, TrendingUp, CircleDollarSign, Loader2 } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useClientes } from '@/hooks/useClientes'
import { FALLBACK_CURRENCY_VALUE, formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

function DashboardContent() {
  const { userProfile } = useAuth()
  const currency = userProfile?.currency ?? FALLBACK_CURRENCY_VALUE

  const { estatisticas, loading } = useClientes(currency)

  const fallbackValor = formatCurrency(0, currency)
  const formatarValor = (valor: number) => formatCurrency(valor, currency, { fallback: fallbackValor })

  const safeEstatisticas = estatisticas ?? {
    total: 0,
    vendas: 0,
    emProcesso: 0,
    naoVenda: 0,
    valorEmProcesso: 0,
    valorVendido: 0,
  }

  const cards = [
    {
      id: 'total',
      label: 'Total de clientes',
      value: safeEstatisticas.total,
      icon: Users,
      tone: 'from-primary/15 via-primary/10 to-primary/20',
    },
    {
      id: 'vendas',
      label: 'Vendas concluídas',
      value: safeEstatisticas.vendas,
      icon: ShoppingBag,
      tone: 'from-success/20 via-success/10 to-success/20',
    },
    {
      id: 'processo',
      label: 'Em processo',
      value: safeEstatisticas.emProcesso,
      icon: TrendingUp,
      tone: 'from-warning/20 via-warning/10 to-warning/20',
    },
    {
      id: 'nao',
      label: 'Não venda',
      value: safeEstatisticas.naoVenda,
      icon: CircleDollarSign,
      tone: 'from-destructive/15 via-destructive/10 to-destructive/20',
    },
    {
      id: 'valorProcesso',
      label: 'Valor em processo',
      value: formatarValor(safeEstatisticas.valorEmProcesso),
      icon: TrendingUp,
      tone: 'from-accent/20 via-accent/10 to-accent/20',
    },
    {
      id: 'valorVendido',
      label: 'Valor vendido',
      value: formatarValor(safeEstatisticas.valorVendido),
      icon: CircleDollarSign,
      tone: 'from-primary/25 via-primary/10 to-primary/30',
    },
  ]

  return (
    <MainLayout>
      <section className="space-y-8">
        <div className="space-y-3">
          <Badge variant="muted" className="w-fit bg-primary/10 text-primary">
            Visão geral
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Dashboard {userProfile?.company_name || 'Prizely'}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Acompanhe rapidamente o desempenho das oportunidades e negociações do seu time.
            </p>
          </div>
        </div>

        {loading ? (
          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Atualizando métricas
              </CardTitle>
              <CardDescription>Buscando informações mais recentes para o seu painel.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div key={item} className="h-32 animate-pulse rounded-xl bg-muted/60" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ id, label, value, icon: Icon, tone }) => (
              <Card key={id} className={cn('overflow-hidden border-none shadow-soft')}>
                <div className={cn('h-2 w-full bg-gradient-to-r', tone)} />
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </CardDescription>
                  <span className="rounded-full bg-muted/80 p-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-2xl font-semibold text-foreground">{value}</CardTitle>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </MainLayout>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
