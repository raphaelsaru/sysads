'use client'

import { useEffect, useState } from 'react'
import { Filter, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export const ORIGENS = ['Indicação', 'Orgânico / Perfil', 'Anúncio', 'Cliente antigo', 'Site'] as const
export const RESULTADOS = ['Venda', 'Orçamento em Processo', 'Não Venda'] as const
export const QUALIDADES = ['Bom', 'Regular', 'Ruim'] as const

export type FiltroChave =
  | 'busca'
  | 'origem'
  | 'status'
  | 'qualidade'
  | 'valorMin'
  | 'valorMax'
  | 'naoRespondeu'
  | 'comSinal'
  | 'vendaPaga'
  | 'mes'

export const TODOS_MESES = 'todos'

export const filtrosIniciais = {
  busca: '',
  origem: 'todos',
  status: 'todos',
  qualidade: 'todos',
  valorMin: '',
  valorMax: '',
  naoRespondeu: 'todos',
  comSinal: 'todos',
  vendaPaga: 'todos',
  mes: TODOS_MESES,
} satisfies Record<FiltroChave, string>

export type FiltrosState = typeof filtrosIniciais

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      if (typeof window === 'undefined') return
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  return isMobile
}

function gerarMesesAnoVigente(): Array<{ valor: string; label: string }> {
  const agora = new Date()
  const ano = agora.getFullYear()
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  return meses.map((mes, index) => ({
    valor: `${ano}-${String(index + 1).padStart(2, '0')}`,
    label: `${mes} ${ano}`
  }))
}

const labelsFiltro: Partial<Record<FiltroChave, (valor: string) => string>> = {
  busca: (v) => `Busca: "${v}"`,
  origem: (v) => `Origem: ${v}`,
  status: (v) => `Status: ${v}`,
  qualidade: (v) => `Qualidade: ${v}`,
  valorMin: (v) => `Valor mín: ${v}`,
  valorMax: (v) => `Valor máx: ${v}`,
  naoRespondeu: (v) => (v === 'sim' ? 'Não respondeu' : 'Respondeu'),
  comSinal: (v) => (v === 'sim' ? 'Com sinal' : 'Sem sinal'),
  vendaPaga: (v) => (v === 'pagos' ? 'Vendas pagas' : 'Vendas pendentes'),
  mes: (v) => {
    const mes = gerarMesesAnoVigente().find((m) => m.valor === v)
    return `Mês: ${mes?.label ?? v}`
  },
}

interface BuscaInputProps {
  valor: string
  onChange: (valor: string) => void
}

function BuscaDebounced({ valor, onChange }: BuscaInputProps) {
  const [local, setLocal] = useState(valor)

  useEffect(() => {
    setLocal(valor)
  }, [valor])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (local !== valor) onChange(local)
    }, 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  return (
    <Input
      placeholder="Buscar por nome ou contato"
      value={local}
      onChange={(event) => setLocal(event.target.value)}
    />
  )
}

interface ClienteFiltrosPanelProps {
  filtros: FiltrosState
  atualizarFiltro: (campo: FiltroChave, valor: string) => void
  limparFiltros: () => void
  totalCarregado: number
  totalGeral: number
  mostrarStatus?: boolean
  mostrarPagamento?: boolean
  mostrarMes?: boolean
}

export default function ClienteFiltrosPanel({
  filtros,
  atualizarFiltro,
  limparFiltros,
  totalCarregado,
  totalGeral,
  mostrarStatus = true,
  mostrarPagamento = false,
  mostrarMes = true,
}: ClienteFiltrosPanelProps) {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const mesesAno = gerarMesesAnoVigente()

  const filtrosAtivos = (Object.keys(filtrosIniciais) as FiltroChave[]).filter(
    (chave) => filtros[chave] !== filtrosIniciais[chave]
  )

  const conteudoFiltros = (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {mostrarMes && (
          <Select value={filtros.mes} onValueChange={(valor) => atualizarFiltro('mes', valor)}>
            <SelectTrigger>
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_MESES}>Todos os meses</SelectItem>
              {mesesAno.map((mes) => (
                <SelectItem key={mes.valor} value={mes.valor}>
                  {mes.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <BuscaDebounced
          valor={filtros.busca}
          onChange={(valor) => atualizarFiltro('busca', valor)}
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

        {mostrarStatus && (
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
        )}

        {mostrarPagamento && (
          <Select value={filtros.vendaPaga} onValueChange={(valor) => atualizarFiltro('vendaPaga', valor)}>
            <SelectTrigger>
              <SelectValue placeholder="Status de pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pagos">Vendas pagas</SelectItem>
              <SelectItem value="pendentes">Vendas pendentes</SelectItem>
            </SelectContent>
          </Select>
        )}

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

        <Select value={filtros.naoRespondeu} onValueChange={(valor) => atualizarFiltro('naoRespondeu', valor)}>
          <SelectTrigger>
            <SelectValue placeholder="Não respondeu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sim">Não respondeu</SelectItem>
            <SelectItem value="nao">Respondeu</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.comSinal} onValueChange={(valor) => atualizarFiltro('comSinal', valor)}>
          <SelectTrigger>
            <SelectValue placeholder="Com sinal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sim">Com sinal</SelectItem>
            <SelectItem value="nao">Sem sinal</SelectItem>
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

      {filtrosAtivos.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filtrosAtivos.map((chave) => (
            <Badge
              key={chave}
              variant="secondary"
              className="flex items-center gap-1 pr-1 font-normal"
            >
              {labelsFiltro[chave]?.(filtros[chave]) ?? filtros[chave]}
              <button
                type="button"
                onClick={() => atualizarFiltro(chave, filtrosIniciais[chave])}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remover filtro ${chave}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Exibindo {totalCarregado} de {totalGeral} clientes
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="self-start sm:self-auto"
          onClick={limparFiltros}
          disabled={filtrosAtivos.length === 0}
        >
          Limpar filtros
        </Button>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2">
            <Filter className="h-4 w-4" />
            Filtros{filtrosAtivos.length > 0 && ` (${filtrosAtivos.length})`}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtros avançados</SheetTitle>
            <SheetDescription>
              Filtre seus clientes para encontrar o que precisa rapidamente
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {conteudoFiltros}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 pb-4 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filtros avançados
      </div>
      {conteudoFiltros}
    </div>
  )
}
