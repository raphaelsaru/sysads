'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users, DollarSign, CheckCircle2, Clock, Loader2, Search, Filter } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ClienteTable from '@/components/ClienteTable'
import ClienteModal from '@/components/ClienteModal'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useClientes } from '@/hooks/useClientes'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Cliente, NovoCliente } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FALLBACK_CURRENCY_VALUE, formatCurrency } from '@/lib/currency'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  
  // Usar moeda do usuário impersonado se houver, senão usar a do usuário logado
  const currency = (impersonatedUser?.currency ?? userProfile?.currency ?? FALLBACK_CURRENCY_VALUE) as 'BRL' | 'USD' | 'EUR'

  const {
    clientes,
    loading,
    loadingMais,
    adicionarCliente,
    editarCliente,
    excluirCliente,
    hasMore,
    carregarMaisClientes,
  } = useClientes(currency, impersonatedUserId)

  const [mostrarModal, setMostrarModal] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<Cliente | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [filtroPagamento, setFiltroPagamento] = useState<'todos' | 'pagos' | 'pendentes'>('todos')

  // Filtrar apenas clientes com resultado = 'Venda'
  const clientesVenda = useMemo(() => {
    return clientes.filter(cliente => cliente.resultado === 'Venda')
  }, [clientes])

  // Verificar se há um ID na URL para abrir o modal de edição
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      if (clientesVenda.length === 0 && loading) {
        return
      }
      
      const clienteParaEditar = clientesVenda.find((c) => c.id === editId)
      if (clienteParaEditar) {
        setClienteEditando(clienteParaEditar)
        setMostrarModal(true)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [searchParams, clientesVenda, loading])

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

  // Estatísticas dos clientes
  const estatisticas = useMemo(() => {
    const total = clientesVenda.length
    const valorTotal = clientesVenda.reduce((acc, c) => acc + (c.valorFechadoNumero || 0), 0)
    const vendasPagas = clientesVenda.filter(c => c.vendaPaga).length
    const vendasPendentes = total - vendasPagas
    const comSinal = clientesVenda.filter(c => c.pagouSinal).length
    const valorPendente = clientesVenda
      .filter(c => !c.vendaPaga)
      .reduce((acc, c) => acc + (c.valorFechadoNumero || 0), 0)

    return {
      total,
      valorTotal,
      vendasPagas,
      vendasPendentes,
      comSinal,
      valorPendente,
    }
  }, [clientesVenda])

  // Filtrar clientes com base na busca e filtro de pagamento
  const clientesFiltrados = useMemo(() => {
    let filtrados = clientesVenda

    // Filtro de busca
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      filtrados = filtrados.filter(cliente => {
        const nome = (cliente.nome ?? '').toLowerCase()
        const contato = (cliente.whatsappInstagram ?? '').toLowerCase()
        return nome.includes(termo) || contato.includes(termo)
      })
    }

    // Filtro de pagamento
    if (filtroPagamento === 'pagos') {
      filtrados = filtrados.filter(c => c.vendaPaga)
    } else if (filtroPagamento === 'pendentes') {
      filtrados = filtrados.filter(c => !c.vendaPaga)
    }

    return filtrados
  }, [clientesVenda, busca, filtroPagamento])

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
                Meus Clientes
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Gerencie seus clientes que já fecharam venda. Acompanhe pagamentos, atualize informações e mantenha o relacionamento ativo.
              </p>
            </div>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 bg-card/70 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.total}</div>
              <p className="text-xs text-muted-foreground">
                Clientes com venda fechada
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(estatisticas.valorTotal, currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Soma de todas as vendas
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-soft">
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

          <Card className="border-border/70 bg-card/70 shadow-soft">
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

        {/* Filtros */}
        <Card className="border-border/70 bg-card/70 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nome ou contato..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status de pagamento</label>
                <Select value={filtroPagamento} onValueChange={(value: 'todos' | 'pagos' | 'pendentes') => setFiltroPagamento(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pagos">Vendas pagas</SelectItem>
                    <SelectItem value="pendentes">Vendas pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(busca || filtroPagamento !== 'todos') && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Exibindo {clientesFiltrados.length} de {clientesVenda.length} clientes
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBusca('')
                    setFiltroPagamento('todos')
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela de Clientes */}
        {loading && clientesVenda.length === 0 ? (
          <Card className="border-border/70 bg-card/70">
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
        ) : clientesFiltrados.length === 0 ? (
          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle className="text-lg">Nenhum cliente encontrado</CardTitle>
              <CardDescription>
                {clientesVenda.length === 0
                  ? 'Você ainda não tem clientes com venda fechada. Quando um lead for convertido em venda, ele aparecerá aqui.'
                  : 'Nenhum cliente corresponde aos filtros selecionados.'}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ClienteTable
            clientes={clientesFiltrados}
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

