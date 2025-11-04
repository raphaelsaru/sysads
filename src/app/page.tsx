'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Filter, Plus, Loader2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ClienteTable from '@/components/ClienteTable'
import ClienteModal from '@/components/ClienteModal'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useClientes } from '@/hooks/useClientes'
import { useDailyQuote } from '@/hooks/useDailyQuote'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Cliente, NovoCliente } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FALLBACK_CURRENCY_VALUE } from '@/lib/currency'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

const ORIGENS = ['Indicação', 'Orgânico / Perfil', 'Anúncio', 'Cliente antigo'] as const
const RESULTADOS = ['Venda', 'Orçamento em Processo', 'Não Venda'] as const
const QUALIDADES = ['Bom', 'Regular', 'Ruim'] as const

type FiltroChave = 'busca' | 'origem' | 'status' | 'qualidade' | 'valorMin' | 'valorMax'

const filtrosIniciais = {
  busca: '',
  origem: 'todos',
  status: 'todos',
  qualidade: 'todos',
  valorMin: '',
  valorMax: '',
} satisfies Record<FiltroChave, string>

function HomePage() {
  const { userProfile } = useAuth()
  const { impersonatedUserId, impersonatedUser } = useAdmin()
  const { quote, loading: quoteLoading } = useDailyQuote()
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
  const [filtros, setFiltros] = useState(filtrosIniciais)

  // Verificar se há um ID na URL para abrir o modal de edição
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      // Se os clientes ainda não foram carregados, aguardar
      if (clientes.length === 0 && loading) {
        return
      }
      
      const clienteParaEditar = clientes.find((c) => c.id === editId)
      if (clienteParaEditar) {
        setClienteEditando(clienteParaEditar)
        setMostrarModal(true)
        // Limpar a URL para não manter o parâmetro
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
      // Disparar evento para atualizar notificações após salvar com sucesso
      window.dispatchEvent(new CustomEvent('cliente-atualizado'))
    } catch (error) {
      // Não disparar evento se houver erro
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
    // Disparar evento para atualizar notificações após excluir
    window.dispatchEvent(new CustomEvent('cliente-atualizado'))
  }

  const atualizarFiltro = (campo: FiltroChave, valor: string) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor,
    }))
  }

  const limparFiltros = () => {
    setFiltros(filtrosIniciais)
  }

  const clientesFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase()
    const origem = filtros.origem
    const status = filtros.status
    const qualidade = filtros.qualidade
    const valorMin = filtros.valorMin !== '' ? Number(filtros.valorMin) : undefined
    const valorMax = filtros.valorMax !== '' ? Number(filtros.valorMax) : undefined

    return clientes.filter((clienteAtual) => {
      const nome = (clienteAtual.nome ?? '').toLowerCase()
      const contato = (clienteAtual.whatsappInstagram ?? '').toLowerCase()
      const valorNumero = clienteAtual.valorFechadoNumero ?? 0

      if (termo && !nome.includes(termo) && !contato.includes(termo)) {
        return false
      }

      if (origem !== 'todos' && clienteAtual.origem !== origem) {
        return false
      }

      if (status !== 'todos' && clienteAtual.resultado !== status) {
        return false
      }

      if (qualidade !== 'todos' && clienteAtual.qualidadeContato !== qualidade) {
        return false
      }

      if (valorMin !== undefined && !Number.isNaN(valorMin) && valorNumero < valorMin) {
        return false
      }

      if (valorMax !== undefined && !Number.isNaN(valorMax) && valorNumero > valorMax) {
        return false
      }

      return true
    })
  }, [clientes, filtros])

  const filtrosAtivos = useMemo(() => {
    return (
      filtros.busca.trim() !== '' ||
      filtros.origem !== 'todos' ||
      filtros.status !== 'todos' ||
      filtros.qualidade !== 'todos' ||
      filtros.valorMin !== '' ||
      filtros.valorMax !== ''
    )
  }, [filtros])

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
              <div className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {impersonatedUser ? (
                  <p>Visualizando clientes de <strong>{impersonatedUser.company_name}</strong></p>
                ) : quoteLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Carregando inspiração do dia...</span>
                  </div>
                ) : quote ? (
                  <div className="space-y-1">
                    <p className="italic">{`"${quote.q}"`}</p>
                    <p className="text-xs text-muted-foreground/80">— {quote.a}</p>
                  </div>
                ) : (
                  <p>Centralize oportunidades, acompanhe negociações e ofereça experiências marcantes em cada contato.</p>
                )}
              </div>
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

        <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-soft">
          <div className="flex items-center gap-2 pb-4 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros avançados
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Input
              placeholder="Buscar por nome ou contato"
              value={filtros.busca}
              onChange={(event) => atualizarFiltro('busca', event.target.value)}
            />

            <Select value={filtros.origem} onValueChange={(valor) => atualizarFiltro('origem', valor)}>
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as origens</SelectItem>
                {ORIGENS.map((origem) => (
                  <SelectItem key={origem} value={origem}>
                    {origem}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtros.status} onValueChange={(valor) => atualizarFiltro('status', valor)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {RESULTADOS.map((resultado) => (
                  <SelectItem key={resultado} value={resultado}>
                    {resultado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtros.qualidade} onValueChange={(valor) => atualizarFiltro('qualidade', valor)}>
              <SelectTrigger>
                <SelectValue placeholder="Qualidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as qualidades</SelectItem>
                {QUALIDADES.map((qualidade) => (
                  <SelectItem key={qualidade} value={qualidade}>
                    {qualidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={0}
              placeholder="Valor mín"
              value={filtros.valorMin}
              onChange={(event) => atualizarFiltro('valorMin', event.target.value)}
            />

            <Input
              type="number"
              min={0}
              placeholder="Valor máx"
              value={filtros.valorMax}
              onChange={(event) => atualizarFiltro('valorMax', event.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Exibindo {clientesFiltrados.length} de {clientes.length} clientes
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="self-start sm:self-auto"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
            >
              Limpar filtros
            </Button>
          </div>
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
