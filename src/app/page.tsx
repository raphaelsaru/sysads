'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ClienteTable from '@/components/ClienteTable'
import ClienteForm from '@/components/ClienteForm'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ClienteFiltrosPanel, { filtrosIniciais, TODOS_MESES } from '@/components/ClienteFiltros'
import { useClientes, ClienteDuplicadoError, type ClienteFiltrosInput } from '@/hooks/useClientes'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Cliente, NovoCliente } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FALLBACK_CURRENCY_VALUE } from '@/lib/currency'
import { getCategoriasParaUsuario } from '@/lib/leadCategoria'

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
  const { user, userProfile } = useAuth()
  const { impersonatedUserId, impersonatedUser } = useAdmin()
  const searchParams = useSearchParams()
  const router = useRouter()

  const currency = (impersonatedUser?.currency ?? userProfile?.currency ?? FALLBACK_CURRENCY_VALUE) as 'BRL' | 'USD' | 'EUR'
  const effectiveUserId = impersonatedUserId ?? user?.id
  const categorias = getCategoriasParaUsuario(effectiveUserId)

  const isAdmin = userProfile?.role === 'admin'
  const mostrarColunaUsuario = isAdmin && !impersonatedUserId
  const [nomesPorUsuario, setNomesPorUsuario] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!mostrarColunaUsuario) return
    fetch('/api/admin/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.users) return
        const mapa: Record<string, string> = {}
        for (const u of data.users as { id: string; company_name: string }[]) {
          mapa[u.id] = u.company_name
        }
        setNomesPorUsuario(mapa)
      })
      .catch(() => {})
  }, [mostrarColunaUsuario])

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
    categoria: filtros.categoria !== 'todos' ? filtros.categoria : undefined,
  }), [filtros])

  const {
    clientes,
    total,
    loading,
    loadingMais,
    adicionarCliente,
    excluirCliente,
    hasMore,
    carregarMaisClientes,
  } = useClientes(currency, impersonatedUserId, filtrosQuery)

  const [mostrarModal, setMostrarModal] = useState(false)

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      router.replace(`/leads/${editId}`)
    }
  }, [searchParams, router])

  const handleSubmitForm = async (dadosCliente: NovoCliente) => {
    try {
      await adicionarCliente(dadosCliente)
      setMostrarModal(false)
      window.dispatchEvent(new CustomEvent('cliente-atualizado'))
    } catch (error) {
      if (error instanceof ClienteDuplicadoError) {
        setMostrarModal(false)
        alert('Esse lead já está cadastrado. Você será direcionado para a página dele para lançar a negociação.')
        router.push(`/leads/${error.clienteId}`)
        return
      }
      throw error
    }
  }

  const handleEditarCliente = (cliente: Cliente) => {
    if (!cliente.id) return
    router.push(`/leads/${cliente.id}`)
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
          categorias={categorias}
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
            userId={effectiveUserId}
            mostrarUsuario={mostrarColunaUsuario}
            nomesPorUsuario={nomesPorUsuario}
          />
        )}

        <Dialog open={mostrarModal} onOpenChange={setMostrarModal}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="sr-only">Novo cliente</DialogTitle>
            </DialogHeader>
            <ClienteForm
              onSubmit={handleSubmitForm}
              onCancel={() => setMostrarModal(false)}
              userId={effectiveUserId}
            />
          </DialogContent>
        </Dialog>
      </section>
    </MainLayout>
  )
}
