'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus, Loader2, Users, TrendingUp, ShoppingBag, CircleDollarSign } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ClienteTable from '@/components/ClienteTable'
import ClienteModal from '@/components/ClienteModal'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useClientes } from '@/hooks/useClientes'
import { useAuth } from '@/contexts/AuthContext'
import { Cliente, NovoCliente } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FALLBACK_CURRENCY_VALUE, formatCurrency } from '@/lib/currency'

export default function Home() {
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  )
}

function HomePage() {
  const { userProfile } = useAuth()
  const currency = userProfile?.currency ?? FALLBACK_CURRENCY_VALUE

  const {
    clientes,
    loading,
    loadingMais,
    adicionarCliente,
    editarCliente,
    excluirCliente,
    estatisticas,
    hasMore,
    carregarMaisClientes,
  } = useClientes(currency)

  const [mostrarModal, setMostrarModal] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<Cliente | undefined>(undefined)

  const handleSubmitForm = async (dadosCliente: NovoCliente) => {
    if (clienteEditando) {
      await editarCliente(clienteEditando.id!, dadosCliente)
      setClienteEditando(undefined)
    } else {
      await adicionarCliente(dadosCliente)
    }
  }

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteEditando(cliente)
    setMostrarModal(true)
  }

  const handleFecharModal = () => {
    setMostrarModal(false)
    setClienteEditando(undefined)
  }

  const formatarValor = useCallback(
    (valor: number) => formatCurrency(valor, currency, { fallback: formatCurrency(0, currency) }),
    [currency]
  )

  const cards = useMemo(
    () => [
      {
        id: 'total',
        label: 'Total de clientes',
        value: estatisticas.total,
        icon: Users,
        tone: 'from-primary/15 via-primary/10 to-primary/20',
      },
      {
        id: 'vendas',
        label: 'Vendas concluídas',
        value: estatisticas.vendas,
        icon: ShoppingBag,
        tone: 'from-success/20 via-success/10 to-success/20',
      },
      {
        id: 'processo',
        label: 'Em processo',
        value: estatisticas.emProcesso,
        icon: TrendingUp,
        tone: 'from-warning/20 via-warning/10 to-warning/20',
      },
      {
        id: 'nao',
        label: 'Não venda',
        value: estatisticas.naoVenda,
        icon: CircleDollarSign,
        tone: 'from-destructive/15 via-destructive/10 to-destructive/20',
      },
      {
        id: 'valorProcesso',
        label: 'Valor em processo',
        value: formatarValor(estatisticas.valorEmProcesso),
        icon: TrendingUp,
        tone: 'from-accent/20 via-accent/10 to-accent/20',
      },
      {
        id: 'valorVendido',
        label: 'Valor vendido',
        value: formatarValor(estatisticas.valorVendido),
        icon: CircleDollarSign,
        tone: 'from-primary/25 via-primary/10 to-primary/30',
      },
    ],
    [estatisticas, formatarValor]
  )

  return (
    <MainLayout>
      <section className="space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="muted" className="w-fit bg-primary/10 text-primary">
              CRM Premium
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                CRM {userProfile?.company_name || 'Prizely'}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Centralize oportunidades, acompanhe negociações e ofereça experiências marcantes em cada contato.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setMostrarModal(true)}
            className="h-12 gap-2 self-start rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" />
            Novo cliente
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ id, label, value, icon: Icon, tone }) => (
            <Card key={id} className={cn('overflow-hidden border-none shadow-soft')}
            >
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
                <CardTitle className="text-2xl font-semibold text-foreground">
                  {value}
                </CardTitle>
              </CardContent>
            </Card>
          ))}
        </div>

        {loading && clientes.length === 0 ? (
          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Carregando clientes
              </CardTitle>
              <CardDescription>
                Buscando informações mais recentes para o seu painel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/60" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <ClienteTable
            clientes={clientes}
            onEdit={handleEditarCliente}
            onDelete={excluirCliente}
            onLoadMore={carregarMaisClientes}
            hasMore={hasMore}
            isLoadingMore={loadingMais}
          />
        )}

        <ClienteModal
          isOpen={mostrarModal}
          onClose={handleFecharModal}
          onSave={handleSubmitForm}
          cliente={clienteEditando}
          currency={currency}
        />
      </section>
    </MainLayout>
  )
}
