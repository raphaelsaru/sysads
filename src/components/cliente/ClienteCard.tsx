'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, type SupportedCurrency } from '@/lib/currency'
import type { Cliente } from '@/types/crm'

type StatusPagamento = { label: string; variant: 'success' | 'warning' | 'outline' }

function statusPagamento(c: Cliente): StatusPagamento {
  const n = c.ultimaNegociacao
  if (n?.vendaPaga) return { label: 'Pago', variant: 'success' }
  if (n?.pagouSinal) return { label: 'Sinal pago', variant: 'warning' }
  return { label: 'A receber', variant: 'outline' }
}

// dataContato é `date` (YYYY-MM-DD); T00:00 evita deslocamento de fuso.
function formatarData(data: string) {
  return new Date(`${data}T00:00`).toLocaleDateString('pt-BR')
}

export default function ClienteCard({ cliente, currency, responsavel }: {
  cliente: Cliente
  currency: SupportedCurrency
  responsavel?: string
}) {
  const status = statusPagamento(cliente)
  const ultima = cliente.ultimaNegociacao
  // useClientes só traz a última negociação (sem LTV agregado)
  const valor = cliente.ltv ?? ultima?.valorFechadoNumero ?? null

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
            {cliente.totalFollowUps ? ` · ${cliente.totalFollowUps} follow-ups` : ''}
          </div>
          {responsavel && <div className="truncate text-xs text-muted-foreground">Responsável: {responsavel}</div>}
        </CardContent>
      </Card>
    </Link>
  )
}
