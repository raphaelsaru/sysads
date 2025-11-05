'use client'

import 'react-day-picker/dist/style.css'

import { useEffect, useMemo, useState } from 'react'
import { Users, ShoppingBag, TrendingUp, CircleDollarSign, Loader2, RefreshCcw, DollarSign, CheckCircle2, Bell } from 'lucide-react'
import { eachDayOfInterval, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns'
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type DateRange } from '@/components/ui/calendar'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { FALLBACK_CURRENCY_VALUE, formatCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'

const supabase = createClient()

interface HistoricoDia {
  isoDate: string
  label: string
  leads: number
  valor: number
}

interface PeriodoResumo {
  total: number
  vendas: number
  emProcesso: number
  naoVenda: number
  valorEmProcesso: number
  valorVendido: number
  vendasComSinal: number
  vendasPagas: number
  leadsComLembrete: number
}

function DashboardContent() {
  const { userProfile } = useAuth()
  const { impersonatedUserId, impersonatedUser } = useAdmin()
  
  // Usar moeda padrão (currency não está implementada por usuário ainda)
  const currency = FALLBACK_CURRENCY_VALUE as 'BRL' | 'USD' | 'EUR'

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    return {
      from: startOfMonth(today),
      to: endOfMonth(today),
    }
  })
  const [historico, setHistorico] = useState<HistoricoDia[]>([])
  const [periodSummary, setPeriodSummary] = useState<PeriodoResumo>({
    total: 0,
    vendas: 0,
    emProcesso: 0,
    naoVenda: 0,
    valorEmProcesso: 0,
    valorVendido: 0,
    vendasComSinal: 0,
    vendasPagas: 0,
    leadsComLembrete: 0,
  })
  const [historicoLoading, setHistoricoLoading] = useState(true)
  const [historicoError, setHistoricoError] = useState<string | null>(null)

  const fallbackValor = formatCurrency(0, currency)
  const formatarValor = (valor: number) => formatCurrency(valor, currency, { fallback: fallbackValor })

  const periodoLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Selecione um período'
    const fromLabel = format(dateRange.from, 'dd/MM/yyyy')
    const toLabel = format(dateRange.to, 'dd/MM/yyyy')
    return `${fromLabel} - ${toLabel}`
  }, [dateRange])

  const conversao = periodSummary.total > 0 ? (periodSummary.vendas / periodSummary.total) * 100 : 0
  const ticketMedio = periodSummary.vendas > 0 ? periodSummary.valorVendido / periodSummary.vendas : 0

  useEffect(() => {
    const carregarHistorico = async () => {
      if (!dateRange?.from || !dateRange?.to) {
        setHistorico([])
        setPeriodSummary({
          total: 0,
          vendas: 0,
          emProcesso: 0,
          naoVenda: 0,
          valorEmProcesso: 0,
          valorVendido: 0,
          vendasComSinal: 0,
          vendasPagas: 0,
          leadsComLembrete: 0,
        })
        setHistoricoLoading(false)
        setHistoricoError(null)
        return
      }

      setHistoricoLoading(true)
      setHistoricoError(null)

      const inicioISO = format(dateRange.from, 'yyyy-MM-dd')
      const fimISO = format(dateRange.to, 'yyyy-MM-dd')

      try {
        // Verificar se o usuário está autenticado
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          throw new Error('Usuário não autenticado')
        }

        // Usar impersonatedUserId se houver, senão usar o user.id
        const effectiveUserId = impersonatedUserId || user.id

        const { data, error } = await supabase
          .from('clientes')
          .select('data_contato, resultado, valor_fechado, pagou_sinal, venda_paga, data_lembrete_chamada')
          .eq('user_id', effectiveUserId)
          .gte('data_contato', inicioISO)
          .lte('data_contato', fimISO)
          .order('data_contato', { ascending: true })

        if (error) {
          throw error
        }

        const registros = data ?? []

        const diasIntervalo = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
        const leadsPorDia = new Map<string, number>()
        const valorPorDia = new Map<string, number>()
        let totalLeads = 0
        let totalVendas = 0
        let totalEmProcesso = 0
        let totalNaoVenda = 0
        let totalValorVendido = 0
        let totalValorEmProcesso = 0
        let totalVendasComSinal = 0
        let totalVendasPagas = 0
        let totalLeadsComLembrete = 0

        for (const item of registros) {
          const dataContatoRaw = item.data_contato as string | null
          if (!dataContatoRaw) continue

          const dataContato = parseISO(dataContatoRaw)
          if (!isValid(dataContato)) continue

          const chave = format(dataContato, 'yyyy-MM-dd')

          leadsPorDia.set(chave, (leadsPorDia.get(chave) ?? 0) + 1)
          totalLeads += 1

          const valorFechado = typeof item.valor_fechado === 'number'
            ? item.valor_fechado
            : typeof item.valor_fechado === 'string'
              ? Number(item.valor_fechado) || 0
              : 0

          switch (item.resultado) {
            case 'Venda':
              totalVendas += 1
              totalValorVendido += valorFechado
              valorPorDia.set(chave, (valorPorDia.get(chave) ?? 0) + valorFechado)
              // Contar vendas com sinal e vendas pagas
              if (item.pagou_sinal) totalVendasComSinal += 1
              if (item.venda_paga) totalVendasPagas += 1
              break
            case 'Orçamento em Processo':
              totalEmProcesso += 1
              totalValorEmProcesso += valorFechado
              break
            case 'Não Venda':
              totalNaoVenda += 1
              break
            default:
              break
          }

          // Contar leads com lembrete
          if (item.data_lembrete_chamada) {
            totalLeadsComLembrete += 1
          }
        }

        const historicoFormatado = diasIntervalo.map((dia) => {
          const chave = format(dia, 'yyyy-MM-dd')
          return {
            isoDate: chave,
            label: format(dia, 'dd/MM'),
            leads: leadsPorDia.get(chave) ?? 0,
            valor: valorPorDia.get(chave) ?? 0,
          }
        })

        setHistorico(historicoFormatado)
        setPeriodSummary({
          total: totalLeads,
          vendas: totalVendas,
          emProcesso: totalEmProcesso,
          naoVenda: totalNaoVenda,
          valorEmProcesso: totalValorEmProcesso,
          valorVendido: totalValorVendido,
          vendasComSinal: totalVendasComSinal,
          vendasPagas: totalVendasPagas,
          leadsComLembrete: totalLeadsComLembrete,
        })
      } catch (error) {
        console.error('Erro ao carregar histórico de clientes:', error)
        setHistorico([])
        setPeriodSummary({
          total: 0,
          vendas: 0,
          emProcesso: 0,
          naoVenda: 0,
          valorEmProcesso: 0,
          valorVendido: 0,
          vendasComSinal: 0,
          vendasPagas: 0,
          leadsComLembrete: 0,
        })
        setHistoricoError('Não foi possível carregar os gráficos para o período selecionado.')
      } finally {
        setHistoricoLoading(false)
      }
    }

    void carregarHistorico()
  }, [dateRange, impersonatedUserId])

  const cards = [
    {
      id: 'total',
      label: 'Total de clientes',
      value: periodSummary.total,
      icon: Users,
      tone: 'from-primary/15 via-primary/10 to-primary/20',
    },
    {
      id: 'vendas',
      label: 'Vendas concluídas',
      value: periodSummary.vendas,
      icon: ShoppingBag,
      tone: 'from-success/20 via-success/10 to-success/20',
    },
    {
      id: 'processo',
      label: 'Em processo',
      value: periodSummary.emProcesso,
      icon: TrendingUp,
      tone: 'from-warning/20 via-warning/10 to-warning/20',
    },
    {
      id: 'nao',
      label: 'Não venda',
      value: periodSummary.naoVenda,
      icon: CircleDollarSign,
      tone: 'from-destructive/15 via-destructive/10 to-destructive/20',
    },
    {
      id: 'valorProcesso',
      label: 'Valor em processo',
      value: formatarValor(periodSummary.valorEmProcesso),
      icon: TrendingUp,
      tone: 'from-accent/20 via-accent/10 to-accent/20',
    },
    {
      id: 'valorVendido',
      label: 'Valor vendido',
      value: formatarValor(periodSummary.valorVendido),
      icon: CircleDollarSign,
      tone: 'from-primary/25 via-primary/10 to-primary/30',
    },
    {
      id: 'vendasComSinal',
      label: 'Vendas com sinal',
      value: periodSummary.vendasComSinal,
      icon: DollarSign,
      tone: 'from-blue-500/20 via-blue-400/10 to-blue-500/20',
    },
    {
      id: 'vendasPagas',
      label: 'Vendas pagas',
      value: periodSummary.vendasPagas,
      icon: CheckCircle2,
      tone: 'from-green-500/20 via-green-400/10 to-green-500/20',
    },
    {
      id: 'leadsComLembrete',
      label: 'Leads com lembrete',
      value: periodSummary.leadsComLembrete,
      icon: Bell,
      tone: 'from-amber-500/20 via-amber-400/10 to-amber-500/20',
    },
  ]

  const periodoCards = [
    {
      id: 'conversao',
      label: 'Taxa de conversão',
      value: `${conversao.toFixed(1)}%`,
      helper: `${periodSummary.vendas} vendas de ${periodSummary.total} leads`,
    },
    {
      id: 'ticket',
      label: 'Ticket médio',
      value: formatarValor(ticketMedio || 0),
      helper: periodSummary.vendas > 0 ? 'Baseado em vendas fechadas' : 'Sem vendas no período',
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
              Dashboard {impersonatedUser?.company_name || userProfile?.company_name || 'Prizely'}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              {impersonatedUser 
                ? `Visualizando dados de ${impersonatedUser.company_name}`
                : 'Acompanhe rapidamente o desempenho das oportunidades e negociações do seu time.'
              }
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-2xl">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              fromLabel="Data inicial"
              toLabel="Data final"
              className="gap-2 rounded-full border-border/70 bg-background/80 text-sm font-medium text-foreground shadow-soft hover:bg-background"
              buttonClassName="h-10 w-full sm:w-auto"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 self-start text-xs sm:self-auto sm:text-sm"
            onClick={() => {
              const hoje = new Date()
              setDateRange({ from: startOfMonth(hoje), to: endOfMonth(hoje) })
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Mês atual
          </Button>
        </div>

        {historicoLoading && historico.length === 0 ? (
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
                  <p className="text-xs text-muted-foreground">Período: {periodoLabel}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-border/70 bg-card/80 shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Desempenho por período</CardTitle>
            <CardDescription>Período analisado: {periodoLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {periodoCards.map(({ id, label, value, helper }) => (
                <Card key={id} className="border-border/70 bg-background/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </CardDescription>
                    <CardTitle className="text-2xl font-semibold text-foreground">{value}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{helper}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {historicoError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
                {historicoError}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title="Leads por dia"
                  subtitle={periodoLabel}
                  loading={historicoLoading}
                  empty={historico.length === 0}
                >
                  <LineChart data={historico} margin={{ top: 8, right: 16, left: 8, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="4 4" className="stroke-border/60" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickMargin={8} />
                    <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} width={32} />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ fontWeight: 600 }}
                      formatter={(valor: number) => [valor, 'Leads']}
                    />
                    <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartCard>

                <ChartCard
                  title="Valor fechado por dia"
                  subtitle={periodoLabel}
                  loading={historicoLoading}
                  empty={historico.length === 0 || historico.every((item) => item.valor === 0)}
                >
                  <LineChart data={historico} margin={{ top: 8, right: 16, left: 8, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="4 4" className="stroke-border/60" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickMargin={8} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      width={56}
                      tickFormatter={(valor: number) => formatarValor(valor)}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ fontWeight: 600 }}
                      formatter={(valor: number) => [formatarValor(valor), 'Valor fechado']}
                    />
                    <Line type="monotone" dataKey="valor" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartCard>
              </div>
            )}
          </CardContent>
        </Card>
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

interface ChartCardProps {
  title: string
  subtitle?: string
  loading?: boolean
  empty?: boolean
  children: React.ReactElement
}

function ChartCard({ title, subtitle, loading, empty, children }: ChartCardProps) {
  return (
    <Card className="border-border/70 bg-background/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="h-[260px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Carregando gráfico" />
          </div>
        ) : empty ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhum dado disponível para o período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
