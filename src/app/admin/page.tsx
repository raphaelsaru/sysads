'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Users, BarChart2, Table2, RefreshCcw, User } from 'lucide-react'
import { eachDayOfInterval, endOfMonth, format, isAfter, isBefore, isEqual, parseISO, startOfDay, startOfMonth } from 'date-fns'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import UserManagement from '@/components/admin/UserManagement'
import ImpersonationBanner from '@/components/admin/ImpersonationBanner'
import { createSupabaseClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type DateRange } from '@/components/ui/calendar'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import ClienteTable from '@/components/ClienteTable'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { FALLBACK_CURRENCY_VALUE, formatCurrency } from '@/lib/currency'
import type { Cliente } from '@/types/crm'

interface UserSummary {
  id: string
  company_name: string
  email: string
  currency: 'BRL' | 'USD' | 'EUR'
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
  totalClientes: number
  totalVendas: number
  valorTotal: number
  ativo: boolean
}

interface ClienteRaw {
  id: string
  data_contato: string
  nome: string
  whatsapp_instagram: string
  origem: Cliente['origem']
  orcamento_enviado: boolean
  resultado: Cliente['resultado']
  qualidade_contato: Cliente['qualidadeContato']
  valor_fechado: number | null
  observacao: string | null
}

interface HistoricoDia {
  isoDate: string
  label: string
  leads: number
  valor: number
}

interface PeriodSummary {
  total: number
  vendas: number
  emProcesso: number
  naoVenda: number
  valorEmProcesso: number
  valorVendido: number
}

const periodoInicial = () => {
  const hoje = new Date()
  return {
    from: startOfMonth(hoje),
    to: endOfMonth(hoje),
  }
}

function AdminPageContent() {
  const { userProfile } = useAuth()
  const { impersonation } = useAdmin()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [, setUsersLoading] = useState(true)
  const [, setUsersError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'dashboard' | 'management' | 'user-detail'>('management')

  const fetchUsersFromAPI = async () => {
    setUsersLoading(true)
    setUsersError(null)
    
    try {
      console.log('🔍 Buscando usuários via API de administração...')
      
      // Obter token de acesso do Supabase
      const supabase = createSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('Não autorizado - sessão não encontrada')
      }

      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include', // Incluir cookies de autenticação
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log('✅ Usuários carregados via API:', data.users?.length || 0)
      
      const enrichedUsers = data.users.map((user: any): UserSummary => ({
        id: user.id,
        company_name: user.company_name || 'Empresa sem nome',
        email: user.email,
        currency: user.currency || FALLBACK_CURRENCY_VALUE,
        role: user.role || 'user',
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
        totalClientes: user.totalClientes || 0,
        totalVendas: user.totalVendas || 0,
        valorTotal: user.valorTotal || 0,
        ativo: user.ativo !== false,
      }))

      setUsers(enrichedUsers)
      setSelectedUserId((prev) => prev ?? enrichedUsers[0]?.id ?? null)
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error)
      setUsersError(`Não foi possível carregar os usuários: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchUsersFromAPI()
    }
  }, [userProfile?.role])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  if (userProfile?.role !== 'admin') {
    return (
      <MainLayout>
        <section className="py-24 text-center">
          <div className="mx-auto max-w-md space-y-4">
            <Badge variant="destructive">Acesso restrito</Badge>
            <h1 className="text-2xl font-semibold text-foreground">Você não possui permissão para acessar esta área.</h1>
            <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador do sistema para obter mais informações.
            </p>
          </div>
        </section>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {impersonation.isImpersonating && <ImpersonationBanner />}
      
      <section className="space-y-8">
        <header className="space-y-4">
          <Badge variant="muted" className="w-fit bg-primary/10 text-primary">
            Console administrativo
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
              {impersonation.isImpersonating 
                ? `Visualizando como: ${impersonation.impersonatedUser?.company_name}` 
                : 'Gestão de usuários'
              }
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {impersonation.isImpersonating
                ? `Você está visualizando o sistema como ${impersonation.impersonatedUser?.email}. Todos os dados mostrados são referentes a este usuário.`
                : 'Acompanhe todos os clientes cadastrados na plataforma e mergulhe nas métricas de cada conta para orientar seu time.'
              }
            </p>
          </div>
        </header>

        {/* Navegação entre visualizações */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={viewMode === 'management' ? 'default' : 'outline'}
            onClick={() => setViewMode('management')}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Gerenciamento de Usuários
          </Button>
          {selectedUser && (
            <>
              <Button
                variant={viewMode === 'dashboard' ? 'default' : 'outline'}
                onClick={() => setViewMode('dashboard')}
                className="gap-2"
              >
                <BarChart2 className="h-4 w-4" />
                Dashboard do Usuário
              </Button>
              <Button
                variant={viewMode === 'user-detail' ? 'default' : 'outline'}
                onClick={() => setViewMode('user-detail')}
                className="gap-2"
              >
                <Table2 className="h-4 w-4" />
                Tabela de Clientes
              </Button>
            </>
          )}
        </div>

        {/* Conteúdo baseado no modo de visualização */}
        {viewMode === 'management' && (
          <UserManagement
            users={users}
            onUserUpdate={fetchUsersFromAPI}
            selectedUserId={selectedUserId}
            onUserSelect={(userId) => {
              setSelectedUserId(userId)
              setViewMode('dashboard')
            }}
          />
        )}

        {(viewMode === 'dashboard' || viewMode === 'user-detail') && selectedUser && (
          <Card className="border-border/70 bg-card/80 shadow-soft">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    {selectedUser.company_name}
                  </CardTitle>
                  <CardDescription>{selectedUser.email}</CardDescription>
                </div>
                <Button
                  onClick={() => setViewMode('management')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  Voltar para Gerenciamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <AdminUserDetail
                key={selectedUser.id}
                user={selectedUser}
                viewMode={viewMode === 'dashboard' ? 'dashboard' : 'tabela'}
              />
            </CardContent>
          </Card>
        )}
      </section>
    </MainLayout>
  )
}

function AdminUserDetail({ user, viewMode }: { user: UserSummary; viewMode: 'dashboard' | 'tabela' }) {
  const currency = user.currency ?? FALLBACK_CURRENCY_VALUE
  const [clientesRaw, setClientesRaw] = useState<ClienteRaw[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [clientesError, setClientesError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(periodoInicial)

  useEffect(() => {
    const carregarClientes = async () => {
      setLoadingClientes(true)
      setClientesError(null)
      try {
        console.log('🔍 Carregando clientes do usuário via API admin:', user.id)
        
        // Obter token de acesso do Supabase
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) {
          throw new Error('Não autorizado - sessão não encontrada')
        }

        const response = await fetch(`/api/admin/users/${user.id}/clientes`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include', // Incluir cookies de autenticação
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const data = await response.json()
        console.log('✅ Clientes carregados via API admin:', data.clientes?.length || 0)
        
        setClientesRaw((data.clientes as ClienteRaw[]) ?? [])
      } catch (error) {
        console.error('❌ Erro ao carregar clientes do usuário:', error)
        setClientesError(`Não foi possível carregar os clientes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      } finally {
        setLoadingClientes(false)
      }
    }

    void carregarClientes()
  }, [user.id])

  const periodoLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Selecione um período'
    return `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`
  }, [dateRange])

  const filteredClientes = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return clientesRaw
    }

    const inicio = startOfDay(dateRange.from)
    const fim = startOfDay(dateRange.to)

    return clientesRaw.filter(({ data_contato }) => {
      if (!data_contato) return false
      const contato = parseISO(data_contato)
      if (Number.isNaN(contato.getTime())) return false
      const dia = startOfDay(contato)
      return (
        isEqual(dia, inicio) ||
        isEqual(dia, fim) ||
        (isAfter(dia, inicio) && isBefore(dia, fim))
      )
    })
  }, [clientesRaw, dateRange])

  const periodSummary: PeriodSummary = useMemo(() => {
    return filteredClientes.reduce<PeriodSummary>(
      (acc, cliente) => {
        acc.total += 1
        const valor = cliente.valor_fechado ?? 0
        switch (cliente.resultado) {
          case 'Venda':
            acc.vendas += 1
            acc.valorVendido += valor
            break
          case 'Orçamento em Processo':
            acc.emProcesso += 1
            acc.valorEmProcesso += valor
            break
          case 'Não Venda':
            acc.naoVenda += 1
            break
          default:
            break
        }
        return acc
      },
      {
        total: 0,
        vendas: 0,
        emProcesso: 0,
        naoVenda: 0,
        valorEmProcesso: 0,
        valorVendido: 0,
      }
    )
  }, [filteredClientes])

  const historico: HistoricoDia[] = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return []

    const dias = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
    const mapa = new Map<string, { leads: number; valor: number }>()

    for (const cliente of filteredClientes) {
      if (!cliente.data_contato) continue
      const data = parseISO(cliente.data_contato)
      if (Number.isNaN(data.getTime())) continue
      const chave = format(data, 'yyyy-MM-dd')
      const atual = mapa.get(chave) ?? { leads: 0, valor: 0 }
      atual.leads += 1
      if (cliente.resultado === 'Venda') {
        atual.valor += cliente.valor_fechado ?? 0
      }
      mapa.set(chave, atual)
    }

    return dias.map((dia) => {
      const chave = format(dia, 'yyyy-MM-dd')
      const registro = mapa.get(chave) ?? { leads: 0, valor: 0 }
      return {
        isoDate: chave,
        label: format(dia, 'dd/MM'),
        leads: registro.leads,
        valor: registro.valor,
      }
    })
  }, [dateRange, filteredClientes])

  const clientesFormatados: Cliente[] = useMemo(() => {
    return clientesRaw.map((cliente) => {
      const valorNumero = cliente.valor_fechado ?? null
      return {
        id: cliente.id,
        dataContato: cliente.data_contato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsapp_instagram,
        origem: cliente.origem,
        orcamentoEnviado: cliente.orcamento_enviado ? 'Sim' : 'Não',
        resultado: cliente.resultado,
        qualidadeContato: cliente.qualidade_contato,
        valorFechadoNumero: valorNumero,
        valorFechado: valorNumero !== null ? formatCurrency(valorNumero, currency) : '',
        observacao: cliente.observacao ?? undefined,
      }
    })
  }, [clientesRaw, currency])

  const conversao = periodSummary.total > 0 ? (periodSummary.vendas / periodSummary.total) * 100 : 0
  const ticketMedio = periodSummary.vendas > 0 ? periodSummary.valorVendido / periodSummary.vendas : 0

  const filtrosAtivos = Boolean(dateRange?.from && dateRange?.to)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 shadow-inner sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Período analisado
          </span>
          <span className="text-sm font-medium text-foreground">{periodoLabel}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            buttonClassName="min-w-[220px] gap-2 rounded-full border-border/70 bg-card/80 text-sm font-medium text-foreground hover:bg-card"
            align="end"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setDateRange(periodoInicial())}
            disabled={!filtrosAtivos}
          >
            <RefreshCcw className="h-4 w-4" />
            Mês atual
          </Button>
        </div>
      </div>

      {viewMode === 'dashboard' ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                id: 'total',
                label: 'Total de clientes',
                value: periodSummary.total,
              },
              {
                id: 'vendas',
                label: 'Vendas concluídas',
                value: periodSummary.vendas,
              },
              {
                id: 'processo',
                label: 'Em processo',
                value: periodSummary.emProcesso,
              },
              {
                id: 'nao',
                label: 'Não venda',
                value: periodSummary.naoVenda,
              },
              {
                id: 'valorProcesso',
                label: 'Valor em processo',
                value: formatCurrency(periodSummary.valorEmProcesso, currency),
              },
              {
                id: 'valorVendido',
                label: 'Valor vendido',
                value: formatCurrency(periodSummary.valorVendido, currency),
              },
            ].map(({ id, label, value }) => (
              <Card key={id} className="border-border/70 bg-background/70 shadow-soft">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </CardDescription>
                  <CardTitle className="text-2xl font-semibold text-foreground">{value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Período: {periodoLabel}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/70 bg-background/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">Taxa de conversão</CardTitle>
                <CardDescription>{periodSummary.total} leads no período</CardDescription>
              </CardHeader>
              <CardContent className="flex h-[220px] flex-col items-center justify-center gap-2">
                <span className="text-4xl font-semibold text-primary">{conversao.toFixed(1)}%</span>
                <span className="text-xs text-muted-foreground">
                  {periodSummary.vendas} vendas fechadas
                </span>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">Ticket médio</CardTitle>
                <CardDescription>Com base nas vendas do período selecionado</CardDescription>
              </CardHeader>
              <CardContent className="flex h-[220px] flex-col items-center justify-center gap-2">
                <span className="text-4xl font-semibold text-foreground">
                  {formatCurrency(ticketMedio || 0, currency)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {periodSummary.vendas > 0 ? 'Dados consolidados' : 'Sem vendas registradas'}
                </span>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-background/80 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Leads por dia</CardTitle>
              <CardDescription>Distribuição diária durante o período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              {historico.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado disponível para o intervalo.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Panorama geral</h3>
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      <li>Total de pontos analisados: {historico.length}</li>
                      <li>Maior volume diário de leads: {Math.max(...historico.map((item) => item.leads))}</li>
                      <li>Maior volume diário vendido: {formatCurrency(Math.max(...historico.map((item) => item.valor)), currency)}</li>
                    </ul>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="space-y-2">
                      {historico.slice(-8).map((item) => (
                        <div key={item.isoDate} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium text-foreground">{item.leads} leads</span>
                          <span className="text-right text-muted-foreground">
                            {formatCurrency(item.valor, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {loadingClientes ? (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando clientes do usuário
            </div>
          ) : clientesError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
              {clientesError}
            </div>
          ) : (
            <ClienteTable clientes={clientesFormatados} />
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminPageContent />
    </ProtectedRoute>
  )
}
