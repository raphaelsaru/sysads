'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users, DollarSign, CheckCircle2, Clock, Loader2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ClienteTable from '@/components/ClienteTable'
import ClienteModal from '@/components/ClienteModal'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ClienteFiltrosPanel, { filtrosIniciais, TODOS_MESES } from '@/components/ClienteFiltros'
import { useClientes, type ClienteFiltrosInput } from '@/hooks/useClientes'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Cliente, NovoCliente } from '@/types/crm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FALLBACK_CURRENCY_VALUE, formatCurrency } from '@/lib/currency'

export default function ClientesPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }>
        <ClientesPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}

function ClientesPageContent() {
  const { userProfile } = useAuth()
  const { impersonatedUserId, impersonatedUser } = useAdmin()
  const searchParams = useSearchParams()

  const currency = (impersonatedUser?.currency ?? userProfile?.currency ?? FALLBACK_CURRENCY_VALUE) as 'BRL' | 'USD' | 'EUR'

  const [filtros, setFiltros] = useState(filtrosIniciais)

  const filtrosQuery: ClienteFiltrosInput = useMemo(() => ({
    resultado: 'Venda',
    busca: filtros.busca.trim() || undefined,
    origem: filtros.origem !== 'todos' ? filtros.origem : undefined,
    qualidadeContato: filtros.qualidade !== 'todos' ? filtros.qualidade : undefined,
    valorMin: filtros.valorMin !== '' ? Number(filtros.valorMin) : undefined,
    valorMax: filtros.valorMax !== '' ? Number(filtros.valorMax) : undefined,
    naoRespondeu: filtros.naoRespondeu !== 'todos' ? filtros.naoRespondeu === 'sim' : undefined,
    comSinal: filtros.comSinal !== 'todos' ? filtros.comSinal === 'sim' : undefined,
    vendaPaga: filtros.vendaPaga !== 'todos' ? filtros.vendaPaga === 'pagos' : undefined,
    mes: filtros.mes !== TODOS_MESES ? filtros.mes : undefined,
  }), [filtros])

  const {
    clientes,
    total,
    loading,
    loadingMais,
    adicionarCliente,
    editarCliente,
    excluirCliente,
    hasMore,
    carregarMaisClientes,
    estatisticas,
  } = useClientes(currency, impersonatedUserId, filtrosQuery)

  const [mostrarModal, setMostrarModal] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<Cliente | undefined>(undefined)

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      if (clientes.length === 0 && loading) {
        return
      }

      const clienteParaEditar = clientes.find((c) => c.id === editId)
      if (clienteParaEditar) {
        setClienteEditando(clienteParaEditar)
        setMostrarModal(true)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [searchParams, clientes, loading])

  const handleSubmitForm = async (dadosCliente: NovoCliente) => {
    try {
      if (clienteEditando) {
        await editarCliente(clienteEditando.id!, dadosCliente)
        setClienteEditando(undefined)
      } else {
        await adicionarCliente(dadosCliente)
      }
      window.dispatchEvent(new CustomEvent('cliente-atualizado'))
    } catch (error) {
      throw error
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

  const handleExcluirCliente = async (id: string) => {
    await excluirCliente(id)
    window.dispatchEvent(new CustomEvent('cliente-atualizado'))
  }

  const atualizarFiltro = (campo: keyof typeof filtrosIniciais, valor: string) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor,
    }))
  }

  const limparFiltros = () => {
    setFiltros(filtrosIniciais)
  }

  return (
    <MainLayout>
      <section className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="muted" className="w-fit bg-primary/10 text-primary">
              Gestão de Clientes
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {impersonatedUser ? `Clientes de ${impersonatedUser.company_name}` : 'Meus Clientes'}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {impersonatedUser
                  ? `Visualizando vendas fechadas de ${impersonatedUser.company_name}.`
                  : 'Gerencie seus clientes que já fecharam venda. Acompanhe pagamentos, atualize informações e mantenha o relacionamento ativo.'}
              </p>
            </div>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.vendas}</div>
              <p className="text-xs text-muted-foreground">
                Clientes com venda fechada
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(estatisticas.valorVendido, currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Soma de todas as vendas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Pagas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{estatisticas.vendasPagas}</div>
              <p className="text-xs text-muted-foreground">
                {estatisticas.vendasPendentes} pendentes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Pendente</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(estatisticas.valorPendente, currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                A receber
              </p>
            </CardContent>
          </Card>
        </div>

        <ClienteFiltrosPanel
          filtros={filtros}
          atualizarFiltro={atualizarFiltro}
          limparFiltros={limparFiltros}
          totalCarregado={clientes.length}
          totalGeral={total}
          mostrarStatus={false}
          mostrarPagamento
        />

        {/* Tabela de Clientes */}
        {loading && clientes.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Carregando clientes
              </CardTitle>
              <CardDescription>
                Buscando informações dos seus clientes.
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
        ) : clientes.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nenhum cliente encontrado</CardTitle>
              <CardDescription>
                {estatisticas.vendas === 0
                  ? 'Você ainda não tem clientes com venda fechada. Quando um lead for convertido em venda, ele aparecerá aqui.'
                  : 'Nenhum cliente corresponde aos filtros selecionados.'}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ClienteTable
            clientes={clientes}
            onEdit={handleEditarCliente}
            onDelete={handleExcluirCliente}
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
