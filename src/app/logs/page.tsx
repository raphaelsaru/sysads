'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNomesUsuarios } from '@/hooks/useNomesUsuarios'
import { descreverEvento, type EventoAuditoria } from '@/lib/auditoria'

type Evento = EventoAuditoria & {
  id: number
  ator_id: string | null
  ator_nome: string | null
  registro_id: string | null
  created_at: string
}

const TIPOS = [
  { valor: 'todos', label: 'Tudo' },
  { valor: 'leads', label: 'Leads' },
  { valor: 'negociacoes', label: 'Negociações' },
  { valor: 'followups', label: 'Follow-ups' },
  { valor: 'equipe', label: 'Equipe' },
  { valor: 'empresa', label: 'Empresa' },
]

const LIGADO_AO_LEAD = new Set(['clientes', 'negociacoes', 'follow_ups'])

function quando(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function LogsPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <LogsContent />
      </MainLayout>
    </ProtectedRoute>
  )
}

function LogsContent() {
  const { tenant } = useAuth()
  const nomes = useNomesUsuarios(true, tenant?.id)
  const [filtros, setFiltros] = useState({ ator: 'todos', tipo: 'todos', de: '', ate: '' })
  const [eventos, setEventos] = useState<Evento[]>([])
  const [proximo, setProximo] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const buscar = useCallback(async (antes?: number) => {
    const params = new URLSearchParams()
    if (filtros.ator !== 'todos') params.set('ator', filtros.ator)
    if (filtros.tipo !== 'todos') params.set('tipo', filtros.tipo)
    if (filtros.de) params.set('de', filtros.de)
    if (filtros.ate) params.set('ate', filtros.ate)
    if (antes) params.set('antes', String(antes))
    const res = await fetch(`/api/empresa/logs?${params.toString()}`)
    if (!res.ok) throw new Error('Erro ao carregar logs')
    return (await res.json()) as { eventos: Evento[]; proximo: number | null }
  }, [filtros])

  useEffect(() => {
    if (!tenant?.id) return
    let cancelado = false
    setLoading(true)
    setErro(null)
    buscar()
      .then((d) => { if (!cancelado) { setEventos(d.eventos); setProximo(d.proximo) } })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar os logs.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [buscar, tenant?.id])

  const carregarMais = async () => {
    if (!proximo) return
    setCarregandoMais(true)
    try {
      const d = await buscar(proximo)
      setEventos((prev) => [...prev, ...d.eventos])
      setProximo(d.proximo)
    } catch {
      alert('Erro ao carregar mais logs')
    } finally {
      setCarregandoMais(false)
    }
  }

  const atualizar = (campo: keyof typeof filtros, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }))

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Badge variant="muted" className="w-fit bg-primary/10 text-primary">Logs</Badge>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Histórico de alterações</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Tudo o que a equipe alterou em {tenant?.name ?? 'sua empresa'} nos últimos 12 meses. Ações automáticas (WhatsApp, integrações) não aparecem.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={filtros.ator} onValueChange={(v) => atualizar('ator', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(nomes).map(([id, nome]) => (
                  <SelectItem key={id} value={id}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={filtros.tipo} onValueChange={(v) => atualizar('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logs-de">De</Label>
            <Input id="logs-de" type="date" value={filtros.de} onChange={(e) => atualizar('de', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logs-ate">Até</Label>
            <Input id="logs-ate" type="date" value={filtros.ate} onChange={(e) => atualizar('ate', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando logs
        </div>
      ) : erro ? (
        <Card><CardHeader><CardTitle className="text-lg">{erro}</CardTitle></CardHeader></Card>
      ) : eventos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nenhuma alteração encontrada</CardTitle>
            <CardDescription>Ajuste os filtros ou aguarde novas ações da equipe.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <ul className="divide-y divide-border">
              {eventos.map((e) => {
                const { titulo, detalhes } = descreverEvento(e, nomes)
                const linkLead = LIGADO_AO_LEAD.has(e.tabela) && e.registro_id && e.operacao !== 'DELETE'
                return (
                  <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm">
                        <span className="font-semibold">{e.ator_nome ?? 'Usuário removido'}</span>{' '}
                        {linkLead ? (
                          <Link href={`/leads/${e.registro_id}`} className="underline-offset-2 hover:underline">{titulo}</Link>
                        ) : titulo}
                      </p>
                      {detalhes.length > 0 && (
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {detalhes.map((d, i) => <li key={i} className="break-words">{d}</li>)}
                        </ul>
                      )}
                    </div>
                    <time dateTime={e.created_at} className="shrink-0 text-xs text-muted-foreground">{quando(e.created_at)}</time>
                  </li>
                )
              })}
            </ul>
          </Card>
          {proximo && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={carregarMais} disabled={carregandoMais}>
                {carregandoMais ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
