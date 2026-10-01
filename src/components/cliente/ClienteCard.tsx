'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, type SupportedCurrency } from '@/lib/currency'
import type { Cliente } from '@/types/crm'
import type { Pagamento, TotalCliente } from '@/lib/totais-vendas'

type StatusPagamento = { label: string; variant: 'success' | 'warning' | 'outline' }

const STATUS: Record<Pagamento, StatusPagamento> = {
  pago: { label: 'Pago', variant: 'success' },
  parcial: { label: 'Parcial', variant: 'warning' },
  a_receber: { label: 'A receber', variant: 'outline' },
}

// Sem totais (ainda carregando): cai na última negociação
function statusPagamento(c: Cliente, totais?: TotalCliente): StatusPagamento {
  if (totais) return STATUS[totais.pagamento]
  const n = c.ultimaNegociacao
  if (n?.vendaPaga) return STATUS.pago
  if (n?.pagouSinal) return STATUS.parcial
  return STATUS.a_receber
}

// dataContato é `date` (YYYY-MM-DD); T00:00 evita deslocamento de fuso.
function formatarData(data: string) {
  return new Date(`${data}T00:00`).toLocaleDateString('pt-BR')
}

export default function ClienteCard({ cliente, currency, responsavel, totais }: {
  cliente: Cliente
  currency: SupportedCurrency
  responsavel?: string
  totais?: TotalCliente
}) {
  const status = statusPagamento(cliente, totais)
  const ultima = cliente.ultimaNegociacao
  const valor = totais?.total ?? ultima?.valorFechadoNumero ?? null

  return (
    <Link
      href={`/leads/${cliente.id}`}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{cliente.nome}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">{cliente.whatsappInstagram}</p>
          </div>
          <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="text-lg font-semibold">{formatCurrency(valor, currency, { fallback: '—' })}</div>
          <div className="text-xs text-muted-foreground">
            {ultima?.dataContato ? `Última negociação: ${formatarData(ultima.dataContato)}` : 'Sem negociação'}
            {totais && totais.vendas > 1 ? ` · ${totais.vendas} vendas` : ''}
          </div>
          {responsavel && <div className="truncate text-xs text-muted-foreground">Responsável: {responsavel}</div>}
        </CardContent>
      </Card>
    </Link>
  )
}
