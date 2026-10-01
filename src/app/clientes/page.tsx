'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, DollarSign, CheckCircle2, Clock, Loader2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ClienteCard from '@/components/cliente/ClienteCard'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ClienteFiltrosPanel, { filtrosIniciais, TODOS_MESES } from '@/components/ClienteFiltros'
import { useClientes, type ClienteFiltrosInput } from '@/hooks/useClientes'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FALLBACK_CURRENCY_VALUE, formatCurrency } from '@/lib/currency'
import { getCategoriasParaUsuario } from '@/lib/leadCategoria'
import { pode } from '@/lib/permissions'
import { useNomesUsuarios } from '@/hooks/useNomesUsuarios'
import { useTotaisVendas } from '@/hooks/useTotaisVendas'

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
  const { user, userProfile, tenant } = useAuth()
  const { impersonatedUserId, impersonatedUser } = useAdmin()
  const searchParams = useSearchParams()
  const router = useRouter()

  const currency = (impersonatedUser?.currency ?? userProfile?.currency ?? FALLBACK_CURRENCY_VALUE) as 'BRL' | 'USD' | 'EUR'
  const effectiveUserId = impersonatedUserId ?? user?.id
  const categorias = getCategoriasParaUsuario(effectiveUserId)

  const verEmpresa = pode(userProfile?.role, 'ver_empresa')
  const mostrarResponsavel = verEmpresa && !impersonatedUserId
  const nomesPorUsuario = useNomesUsuarios(mostrarResponsavel, tenant?.id)

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
    categoria: filtros.categoria !== 'todos' ? filtros.categoria : undefined,
  }), [filtros])

  const {
    clientes,
    total,
    loading,
    loadingMais,
    hasMore,
    carregarMaisClientes,
    estatisticas,
  } = useClientes(currency, impersonatedUserId, filtrosQuery)

  const idsClientes = useMemo(() => clientes.flatMap((c) => (c.id ? [c.id] : [])), [clientes])
  const totaisPorCliente = useTotaisVendas(idsClientes)

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      router.replace(`/leads/${editId}`)
    }
  }, [searchParams, router])

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
                {impersonatedUser
                  ? `Clientes de ${impersonatedUser.company_name}`
                  : verEmpresa ? 'Clientes da empresa' : 'Meus clientes'}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {impersonatedUser
                  ? `Visualizando vendas fechadas de ${impersonatedUser.company_name}.`
                  : verEmpresa
                    ? 'Clientes com venda fechada de toda a empresa. Clique em um cliente para ver o detalhe.'
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
          categorias={categorias}
        />

        {/* Cards de Clientes */}
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
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clientes.map((c) => (
                <ClienteCard
                  key={c.id}
                  cliente={c}
                  currency={currency}
                  responsavel={mostrarResponsavel && c.userId ? nomesPorUsuario[c.userId] : undefined}
                  totais={c.id ? totaisPorCliente[c.id] : undefined}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => carregarMaisClientes()} disabled={loadingMais}>
                  {loadingMais ? 'Carregando…' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </MainLayout>
  )
}
