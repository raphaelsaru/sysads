'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ClienteTable from '@/components/ClienteTable'
import ClienteModal from '@/components/ClienteModal'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ClienteFiltrosPanel, { filtrosIniciais, TODOS_MESES } from '@/components/ClienteFiltros'
import { useClientes, type ClienteFiltrosInput } from '@/hooks/useClientes'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Cliente, NovoCliente } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FALLBACK_CURRENCY_VALUE } from '@/lib/currency'

export default function Home() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }>
        <HomePage />
      </Suspense>
    </ProtectedRoute>
  )
}

function HomePage() {
  const { userProfile } = useAuth()
  const { impersonatedUserId, impersonatedUser } = useAdmin()
  const searchParams = useSearchParams()

  const currency = (impersonatedUser?.currency ?? userProfile?.currency ?? FALLBACK_CURRENCY_VALUE) as 'BRL' | 'USD' | 'EUR'

  const [filtros, setFiltros] = useState(filtrosIniciais)

  const filtrosQuery: ClienteFiltrosInput = useMemo(() => ({
    busca: filtros.busca.trim() || undefined,
    origem: filtros.origem !== 'todos' ? filtros.origem : undefined,
    resultado: filtros.status !== 'todos' ? filtros.status : undefined,
    qualidadeContato: filtros.qualidade !== 'todos' ? filtros.qualidade : undefined,
    valorMin: filtros.valorMin !== '' ? Number(filtros.valorMin) : undefined,
    valorMax: filtros.valorMax !== '' ? Number(filtros.valorMax) : undefined,
    naoRespondeu: filtros.naoRespondeu !== 'todos' ? filtros.naoRespondeu === 'sim' : undefined,
    comSinal: filtros.comSinal !== 'todos' ? filtros.comSinal === 'sim' : undefined,
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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="muted" className="w-fit bg-primary/10 text-primary">
              CRM Premium
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Olá {impersonatedUser?.company_name || userProfile?.company_name || 'Prizely'}!
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {impersonatedUser
                  ? `Visualizando leads de ${impersonatedUser.company_name}`
                  : 'Centralize oportunidades, acompanhe negociações e ofereça experiências marcantes em cada contato.'}
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

        <ClienteFiltrosPanel
          filtros={filtros}
          atualizarFiltro={atualizarFiltro}
          limparFiltros={limparFiltros}
          totalCarregado={clientes.length}
          totalGeral={total}
        />

        {loading && clientes.length === 0 ? (
          <Card>
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
        ) : clientes.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nenhum cliente encontrado</CardTitle>
              <CardDescription>
                Nenhum cliente corresponde aos filtros selecionados.
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
