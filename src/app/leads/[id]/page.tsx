'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  DollarSign,
  Handshake,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  TrendingUp,
} from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import NegociacaoForm from '@/components/NegociacaoForm'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { useNegociacoes } from '@/hooks/useNegociacoes'
import { useFollowUps } from '@/hooks/useFollowUps'
import { Cliente, FollowUp, Negociacao, NovaNegociacao, NovoCliente } from '@/types/crm'
import { FALLBACK_CURRENCY_VALUE, formatCurrency, type SupportedCurrency } from '@/lib/currency'
import { formatDateBR } from '@/lib/dateUtils'
import { getCategoriasParaUsuario } from '@/lib/leadCategoria'
import { calcularLtv, calcularTotalVendas } from '@/lib/negociacoes'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'

const ORIGENS: Cliente['origem'][] = [
  'Indicação',
  'Orgânico / Perfil',
  'Anúncio',
  'Cliente antigo',
  'Site',
  'Instagram',
]

const RESULTADO_VARIANT: Record<Negociacao['resultado'], 'success' | 'warning' | 'destructive'> = {
  Venda: 'success',
  'Orçamento em Processo': 'warning',
  'Não Venda': 'destructive',
}

// negociações vindas de fontes diferentes (fetch direto na API vs
// useNegociacoes, que fala com Supabase no browser) representam valorFechado
// de formas diferentes: a API devolve o número cru (`"1500"`), o hook
// devolve moeda formatada (`"R$ 1.500,00"`). Normaliza pra número cru sempre
// que houver valorFechadoNumero/valorSinalNumero disponível, assim o estado
// local fica consistente e o cálculo de LTV (via Number(valorFechado)) nunca
// quebra dependendo de qual caminho criou/editou a negociação.
function normalizarNegociacao(n: Negociacao): Negociacao {
  return {
    ...n,
    valorFechado: n.valorFechadoNumero !== null && n.valorFechadoNumero !== undefined
      ? String(n.valorFechadoNumero)
      : n.valorFechado,
    valorSinal: n.valorSinalNumero !== null && n.valorSinalNumero !== undefined
      ? String(n.valorSinalNumero)
      : n.valorSinal,
  }
}

function valorOuTraco(valor: string | undefined, currency: SupportedCurrency) {
  if (!valor) return '—'
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  return formatCurrency(numero, currency)
}

type TimelineItem =
  | { kind: 'negociacao'; date: string; negociacao: Negociacao }
  | { kind: 'followup'; date: string; followUp: FollowUp }

export default function LeadDetailPage() {
  return (
    <ProtectedRoute>
      <LeadDetailPageContent />
    </ProtectedRoute>
  )
}

function LeadDetailPageContent() {
  const params = useParams<{ id: string }>()
  const clienteId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined
  const router = useRouter()

  const { userProfile } = useAuth()
  const { impersonatedUser } = useAdmin()
  const currency = (impersonatedUser?.currency ?? userProfile?.currency ?? FALLBACK_CURRENCY_VALUE) as typeof FALLBACK_CURRENCY_VALUE

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loadingCliente, setLoadingCliente] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)

  const { followUps, buscarFollowUps, loading: loadingFollowUps } = useFollowUps()
  const { adicionarNegociacao, editarNegociacao } = useNegociacoes(currency)

  const carregarCliente = useCallback(async () => {
    if (!clienteId) return
    setLoadingCliente(true)
    setErroCarregamento(null)
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, { credentials: 'include' })
      if (res.status === 404 || res.status === 401) {
        setNotFound(true)
        setCliente(null)
        return
      }
      if (!res.ok) {
        throw new Error('Erro ao carregar lead')
      }
      const data: Cliente = await res.json()
      setCliente(data)
      setNotFound(false)
    } catch (err) {
      setErroCarregamento(err instanceof Error ? err.message : 'Erro ao carregar lead')
    } finally {
      setLoadingCliente(false)
    }
  }, [clienteId])

  useEffect(() => {
    void carregarCliente()
  }, [carregarCliente])

  useEffect(() => {
    if (clienteId) void buscarFollowUps(clienteId)
  }, [clienteId, buscarFollowUps])

  // ---- KPIs derivados do estado local (não só do payload inicial da API) ----
  // Recalculados aqui (mesma fórmula do GET /api/clientes/[id], via
  // src/lib/negociacoes.ts) em vez de só guardar o `ltv`/contagens que vieram
  // prontos da API, porque negociações criadas/editadas nesta página
  // atualizam `cliente.negociacoes` localmente sem refetch — se ficássemos só
  // com os números iniciais da API eles ficariam desatualizados até um reload.
  const negociacoes = useMemo(() => cliente?.negociacoes ?? [], [cliente])

  const ltv = useMemo(() => calcularLtv(negociacoes), [negociacoes])

  const totalNegociacoes = negociacoes.length
  const totalVendas = useMemo(() => calcularTotalVendas(negociacoes), [negociacoes])

  const ultimaInteracao = useMemo(() => {
    const datas = [...negociacoes.map((n) => n.dataContato), ...followUps.map((f) => f.createdAt)]
    if (datas.length === 0) return null
    return datas.reduce((max, d) => (new Date(d).getTime() > new Date(max).getTime() ? d : max))
  }, [negociacoes, followUps])

  const timeline = useMemo<TimelineItem[]>(() => {
    const itens: TimelineItem[] = [
      ...negociacoes.map((negociacao) => ({ kind: 'negociacao' as const, date: negociacao.dataContato, negociacao })),
      ...followUps.map((followUp) => ({ kind: 'followup' as const, date: followUp.createdAt, followUp })),
    ]
    return itens.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [negociacoes, followUps])

  // ---- expandir negociação na timeline ----
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const toggleExpandida = (id: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---- modal de negociação (criar/editar) ----
  const [negociacaoDialogAberto, setNegociacaoDialogAberto] = useState(false)
  const [negociacaoEditando, setNegociacaoEditando] = useState<Negociacao | undefined>(undefined)

  const abrirNovaNegociacao = () => {
    setNegociacaoEditando(undefined)
    setNegociacaoDialogAberto(true)
  }

  const abrirEdicaoNegociacao = (negociacao: Negociacao) => {
    setNegociacaoEditando(negociacao)
    setNegociacaoDialogAberto(true)
  }

  const fecharNegociacaoDialog = () => {
    setNegociacaoDialogAberto(false)
    setNegociacaoEditando(undefined)
  }

  const salvarNegociacao = async (data: NovaNegociacao | Partial<NovaNegociacao>) => {
    if (!clienteId) return
    if (negociacaoEditando) {
      const atualizada = normalizarNegociacao(await editarNegociacao(negociacaoEditando.id, data))
      setCliente((prev) =>
        prev
          ? {
              ...prev,
              negociacoes: (prev.negociacoes ?? []).map((n) => (n.id === atualizada.id ? atualizada : n)),
            }
          : prev
      )
    } else {
      const nova = normalizarNegociacao(await adicionarNegociacao({ ...data, clienteId } as NovaNegociacao))
      setCliente((prev) =>
        prev
          ? {
              ...prev,
              negociacoes: [nova, ...(prev.negociacoes ?? [])],
            }
          : prev
      )
      setExpandidas((prev) => new Set(prev).add(nova.id))
    }
    fecharNegociacaoDialog()
  }

  // ---- edição dos dados da pessoa ----
  const [pessoaDialogAberto, setPessoaDialogAberto] = useState(false)
  const [pessoaForm, setPessoaForm] = useState<NovoCliente | null>(null)
  const [salvandoPessoa, setSalvandoPessoa] = useState(false)

  const donoId = cliente?.userId ?? impersonatedUser?.id ?? userProfile?.id
  const categorias = useMemo(() => getCategoriasParaUsuario(donoId), [donoId])

  const abrirEdicaoPessoa = () => {
    if (!cliente) return
    setPessoaForm({
      dataContato: cliente.dataContato,
      nome: cliente.nome,
      whatsappInstagram: cliente.whatsappInstagram,
      origem: cliente.origem,
      observacao: cliente.observacao ?? '',
      categoria: cliente.categoria ?? '',
    })
    setPessoaDialogAberto(true)
  }

  const handlePessoaChange = (field: keyof NovoCliente, value: string) => {
    setPessoaForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const salvarPessoa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pessoaForm || !clienteId) return
    setSalvandoPessoa(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pessoaForm),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao atualizar dados do lead')
      }
      const atualizado: Cliente = await res.json()
      setCliente((prev) => (prev ? { ...prev, ...atualizado } : atualizado))
      setPessoaDialogAberto(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar dados do lead')
    } finally {
      setSalvandoPessoa(false)
    }
  }

  // ---- estados de carregamento / erro / não encontrado ----
  if (!clienteId) {
    return (
      <MainLayout>
        <Card>
          <CardHeader>
            <CardTitle>Lead inválido</CardTitle>
            <CardDescription>Não foi possível identificar o lead solicitado.</CardDescription>
          </CardHeader>
        </Card>
      </MainLayout>
    )
  }

  if (loadingCliente) {
    return (
      <MainLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </MainLayout>
    )
  }

  if (notFound) {
    return (
      <MainLayout>
        <Card>
          <CardHeader>
            <CardTitle>Lead não encontrado</CardTitle>
            <CardDescription>
              Esse lead não existe, foi removido, ou você não tem acesso a ele.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para leads
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    )
  }

  if (erroCarregamento || !cliente) {
    return (
      <MainLayout>
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar lead</CardTitle>
            <CardDescription>{erroCarregamento ?? 'Tente novamente em instantes.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void carregarCliente()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <section className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Button variant="ghost" className="-ml-3 gap-2 text-muted-foreground" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {cliente.nome}
                </h1>
                {cliente.categoria && <Badge variant="muted">{cliente.categoria}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{cliente.whatsappInstagram}</span>
                <span className="flex items-center gap-1">
                  <Badge variant="outline">{cliente.origem}</Badge>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  1º contato em {formatDateBR(cliente.dataContato)}
                </span>
              </div>
              {cliente.observacao && (
                <p className="max-w-2xl text-sm text-muted-foreground">{cliente.observacao}</p>
              )}
            </div>

            <div className="flex shrink-0 gap-3">
              <Button variant="outline" className="gap-2" onClick={abrirEdicaoPessoa}>
                <Pencil className="h-4 w-4" />
                Editar dados
              </Button>
              <Button className="gap-2" onClick={abrirNovaNegociacao}>
                <Plus className="h-4 w-4" />
                Nova negociação
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">LTV</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(ltv, currency)}</div>
              <p className="text-xs text-muted-foreground">Soma das vendas fechadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negociações</CardTitle>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalNegociacoes}</div>
              <p className="text-xs text-muted-foreground">Total no histórico</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas fechadas</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{totalVendas}</div>
              <p className="text-xs text-muted-foreground">Resultado = Venda</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última interação</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ultimaInteracao ? formatDateBR(ultimaInteracao) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">Negociação ou follow-up mais recente</p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>Negociações e follow-ups, do mais recente para o mais antigo.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFollowUps && timeline.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : timeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma negociação ou follow-up registrado ainda.
              </p>
            ) : (
              <ul className="space-y-3">
                {timeline.map((item) =>
                  item.kind === 'negociacao' ? (
                    <NegociacaoItem
                      key={`negociacao-${item.negociacao.id}`}
                      negociacao={item.negociacao}
                      currency={currency}
                      expandida={expandidas.has(item.negociacao.id)}
                      onToggle={() => toggleExpandida(item.negociacao.id)}
                      onEditar={() => abrirEdicaoNegociacao(item.negociacao)}
                    />
                  ) : (
                    <FollowUpItem key={`followup-${item.followUp.id}`} followUp={item.followUp} />
                  )
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Dialog: nova/editar negociação */}
      <Dialog open={negociacaoDialogAberto} onOpenChange={(open) => (open ? setNegociacaoDialogAberto(true) : fecharNegociacaoDialog())}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{negociacaoEditando ? 'Editar negociação' : 'Nova negociação'}</DialogTitle>
          </DialogHeader>
          <NegociacaoForm
            clienteId={clienteId}
            negociacao={negociacaoEditando}
            onSave={salvarNegociacao}
            onCancel={fecharNegociacaoDialog}
            currency={currency}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: editar dados da pessoa */}
      <Dialog open={pessoaDialogAberto} onOpenChange={setPessoaDialogAberto}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar dados do lead</DialogTitle>
          </DialogHeader>
          {pessoaForm && (
            <form onSubmit={salvarPessoa} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pessoa-nome">Nome</Label>
                <Input
                  id="pessoa-nome"
                  value={pessoaForm.nome}
                  onChange={(e) => handlePessoaChange('nome', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pessoa-contato">WhatsApp / Instagram</Label>
                <Input
                  id="pessoa-contato"
                  value={pessoaForm.whatsappInstagram}
                  onChange={(e) => handlePessoaChange('whatsappInstagram', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pessoa-origem">Origem</Label>
                <Select
                  value={pessoaForm.origem}
                  onValueChange={(value) => handlePessoaChange('origem', value)}
                >
                  <SelectTrigger id="pessoa-origem">
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map((origem) => (
                      <SelectItem key={origem} value={origem}>
                        {origem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pessoa-dataContato">1º contato</Label>
                <DatePicker
                  id="pessoa-dataContato"
                  value={pessoaForm.dataContato}
                  onChange={(value) => handlePessoaChange('dataContato', value ?? '')}
                />
              </div>

              {categorias.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="pessoa-categoria">Categoria</Label>
                  <Select
                    value={pessoaForm.categoria || ''}
                    onValueChange={(value) => handlePessoaChange('categoria', value)}
                  >
                    <SelectTrigger id="pessoa-categoria">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {categoria}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pessoa-observacao">Observações</Label>
                <Textarea
                  id="pessoa-observacao"
                  rows={3}
                  value={pessoaForm.observacao}
                  onChange={(e) => handlePessoaChange('observacao', e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setPessoaDialogAberto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvandoPessoa}>
                  {salvandoPessoa ? 'Salvando...' : 'Salvar dados'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

function NegociacaoItem({
  negociacao,
  currency,
  expandida,
  onToggle,
  onEditar,
}: {
  negociacao: Negociacao
  currency: SupportedCurrency
  expandida: boolean
  onToggle: () => void
  onEditar: () => void
}) {
  return (
    <li className="rounded-xl border border-border/70 bg-muted/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Handshake className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">Negociação</span>
              <Badge variant={RESULTADO_VARIANT[negociacao.resultado]}>{negociacao.resultado}</Badge>
              {negociacao.valorFechado && (
                <span className="text-sm font-semibold text-foreground">
                  {valorOuTraco(negociacao.valorFechado, currency)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formatDateBR(negociacao.dataContato)}</p>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expandida && 'rotate-180')} />
      </button>

      {expandida && (
        <div className="space-y-3 border-t border-border/70 px-4 py-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Campo label="Orçamento enviado" valor={negociacao.orcamentoEnviado ? 'Sim' : 'Não'} />
            <Campo label="Qualidade do contato" valor={negociacao.qualidadeContato ?? '—'} />
            <Campo label="Não respondeu" valor={negociacao.naoRespondeu ? 'Sim' : 'Não'} />
            <Campo label="Pagou sinal" valor={negociacao.pagouSinal ? 'Sim' : 'Não'} />
            {negociacao.pagouSinal && (
              <>
                <Campo label="Valor do sinal" valor={valorOuTraco(negociacao.valorSinal, currency)} />
                <Campo
                  label="Data do pagamento do sinal"
                  valor={negociacao.dataPagamentoSinal ? formatDateBR(negociacao.dataPagamentoSinal) : '—'}
                />
              </>
            )}
            <Campo label="Venda paga" valor={negociacao.vendaPaga ? 'Sim' : 'Não'} />
            {negociacao.vendaPaga && (
              <Campo
                label="Data do pagamento"
                valor={negociacao.dataPagamentoVenda ? formatDateBR(negociacao.dataPagamentoVenda) : '—'}
              />
            )}
            {negociacao.dataLembreteChamada && (
              <Campo label="Lembrete de retorno" valor={formatDateBR(negociacao.dataLembreteChamada)} />
            )}
          </div>

          {negociacao.observacao && (
            <div className="rounded-lg bg-background/60 p-3 text-sm text-muted-foreground">
              {negociacao.observacao}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-2" onClick={onEditar}>
              <Pencil className="h-3.5 w-3.5" />
              Editar negociação
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{valor}</p>
    </div>
  )
}

function FollowUpItem({ followUp }: { followUp: FollowUp }) {
  return (
    <li className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">Follow-up #{followUp.numeroFollowup}</span>
            <Badge variant={followUp.respondeu ? 'success' : 'muted'}>
              {followUp.respondeu ? 'Respondeu' : 'Sem resposta'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatDateBR(followUp.createdAt)}</p>
          {followUp.observacao && <p className="mt-1 text-sm text-muted-foreground">{followUp.observacao}</p>}
        </div>
      </div>
    </li>
  )
}
