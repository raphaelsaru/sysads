'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CircleDollarSign, Loader2, MessageCircle, Pencil, Trash2, ArrowUp, ArrowDown, UserX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Cliente } from '@/types/crm'
import { formatDateBR, formatDateISO } from '@/lib/dateUtils'

type SortField = 'createdAt' | 'dataContato' | 'nome' | 'valorFechado'
type SortOrder = 'asc' | 'desc'

interface ClienteTableProps {
  clientes: Cliente[]
  onEdit?: (cliente: Cliente) => void
  onDelete?: (id: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  isLoadingMore?: boolean
}

const resultadoVariant: Record<Cliente['resultado'], 'success' | 'warning' | 'destructive'> = {
  Venda: 'success',
  'Orçamento em Processo': 'warning',
  'Não Venda': 'destructive',
}

const qualidadeColor: Record<Cliente['qualidadeContato'], string> = {
  Bom: 'bg-success/15 text-success font-semibold',
  Regular: 'bg-warning/20 text-warning font-semibold',
  Ruim: 'bg-destructive/15 text-destructive font-semibold',
}

function StatusBadge({ resultado }: { resultado: Cliente['resultado'] }) {
  return (
    <Badge variant={resultadoVariant[resultado]} className="capitalize">
      {resultado}
    </Badge>
  )
}

function QualidadeBadge({ qualidade }: { qualidade: Cliente['qualidadeContato'] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${qualidadeColor[qualidade]}`}>
      {qualidade}
    </span>
  )
}

export default function ClienteTable({ clientes, onEdit, onDelete, onLoadMore, hasMore = false, isLoadingMore = false }: ClienteTableProps) {
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const clientesOrdenados = useMemo(() => {
    const normalizarData = (valor: string) => {
      if (!valor) return 0
      const iso = formatDateISO(valor)
      const parsed = new Date(iso || valor)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getTime()
      }
      const fallback = new Date(valor)
      return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime()
    }

    const normalizarValor = (valor: string | undefined) => {
      if (!valor) return 0
      const numero = parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.'))
      return Number.isNaN(numero) ? 0 : numero
    }

    return [...clientes].sort((a, b) => {
      let aValue: string | number | Date
      let bValue: string | number | Date

      switch (sortField) {
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0
          break
        case 'dataContato':
          aValue = normalizarData(a.dataContato)
          bValue = normalizarData(b.dataContato)
          break
        case 'nome':
          aValue = a.nome.toLowerCase()
          bValue = b.nome.toLowerCase()
          break
        case 'valorFechado':
          aValue = normalizarValor(a.valorFechado)
          bValue = normalizarValor(b.valorFechado)
          break
        default:
          return 0
      }

      if (sortField === 'nome') {
        return sortOrder === 'asc' 
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue))
      }

      return sortOrder === 'asc' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
    })
  }, [clientes, sortField, sortOrder])

  useEffect(() => {
    if (!onLoadMore || !hasMore) return

    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, onLoadMore, clientes.length])

  const handleDelete = async () => {
    if (clienteParaExcluir?.id && onDelete) {
      await Promise.resolve(onDelete(clienteParaExcluir.id))
    }
    setClienteParaExcluir(null)
  }

  if (clientes.length === 0) {
    return (
      <Card className="border-dashed border-border/80 bg-card/70">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Nenhum cliente encontrado</CardTitle>
          <CardDescription>
            Adicione seu primeiro cliente para começar a acompanhar oportunidades e relacionamentos.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4 lg:hidden">
        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Clientes CRM</CardTitle>
            <CardDescription className="text-sm">
              Monitore o funil de relacionamento e acompanhe os resultados em tempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">Ordenar por</label>
              <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Data de Criação</SelectItem>
                  <SelectItem value="dataContato">Data de Contato</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="valorFechado">Valor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">Ordem</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="gap-2 justify-start"
              >
                {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
              </Button>
            </div>
          </CardContent>
        </Card>
        {clientesOrdenados.map((cliente) => (
          <Card key={cliente.id ?? cliente.nome} className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {cliente.nome}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-1 text-xs">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDateBR(cliente.dataContato)}
                  </CardDescription>
                </div>
                <StatusBadge resultado={cliente.resultado} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span className="font-medium text-foreground">Contato:</span>
                <span className="truncate text-primary">{cliente.whatsappInstagram}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-muted-foreground">Origem</span>
                  <span className="text-sm font-medium text-foreground">{cliente.origem}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-semibold text-muted-foreground">Qualidade</span>
                  <QualidadeBadge qualidade={cliente.qualidadeContato} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2">
                <div className="flex items-center gap-2 text-success">
                  <CircleDollarSign className="h-4 w-4" />
                  <span className="text-sm font-semibold">Valor</span>
                </div>
                <span className="text-sm font-semibold text-success">
                  {cliente.valorFechado || '—'}
                </span>
              </div>
              {cliente.observacao && (
                <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Observações
                  </span>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                    {cliente.observacao}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex items-center justify-end gap-2 pt-0">
              {onEdit && (
                <Button variant="ghost" size="sm" className="gap-2" onClick={() => onEdit(cliente)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              )}
              {onDelete && cliente.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => setClienteParaExcluir(cliente)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="hidden border-border/70 bg-card/80 shadow-soft lg:block">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Clientes CRM</CardTitle>
              <CardDescription>
                Monitore o funil de relacionamento e acompanhe os resultados em tempo real.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Data de Criação</SelectItem>
                  <SelectItem value="dataContato">Data de Contato</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="valorFechado">Valor</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="gap-2"
              >
                {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Qualidade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[110px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesOrdenados.map((cliente) => (
                <TableRow key={cliente.id ?? cliente.nome}>
                  <TableCell className="font-medium">{formatDateBR(cliente.dataContato)}</TableCell>
                  <TableCell className="font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      {cliente.naoRespondeu && (
                        <UserX 
                          className="h-4 w-4 text-destructive flex-shrink-0" 
                          aria-label="Cliente não respondeu"
                        />
                      )}
                      <span>{cliente.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-primary">
                      {cliente.whatsappInstagram}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cliente.origem}</TableCell>
                  <TableCell>
                    <Badge
                      variant={cliente.orcamentoEnviado === 'Sim' ? 'success' : 'muted'}
                      className="uppercase"
                    >
                      {cliente.orcamentoEnviado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge resultado={cliente.resultado} />
                  </TableCell>
                  <TableCell>
                    <QualidadeBadge qualidade={cliente.qualidadeContato} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-success">
                    {cliente.valorFechado || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => onEdit(cliente)}
                          aria-label={`Editar ${cliente.nome}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && cliente.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setClienteParaExcluir(cliente)}
                          aria-label={`Excluir ${cliente.nome}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />

      {isLoadingMore && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-background/80 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Carregando mais clientes
        </div>
      )}

      <AlertDialog open={!!clienteParaExcluir} onOpenChange={(open) => !open && setClienteParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja remover este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O cliente
              <span className="font-semibold text-foreground"> {clienteParaExcluir?.nome} </span>
              será excluído permanentemente dos registros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
