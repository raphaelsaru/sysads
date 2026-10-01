'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Megaphone, RotateCcw, Send } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

type Status = 'pending' | 'processing' | 'sent' | 'failed'

type Diagnostico = {
  integracao: { datasetId: string; isActive: boolean; testEventCode: string | null; tokenConfigurado: boolean } | null
  contagem: Record<Status, number>
  eventos: {
    id: string
    event_name: string
    event_id: string
    status: Status
    attempts: number
    last_error: string | null
    created_at: string
    fbtraceId: string | null
  }[]
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Na fila',
  processing: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
}

async function erroDa(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}))
  return new Error(data.error || fallback)
}

// Conexão Meta Conversions API da empresa. Só superadmin até homologar.
export default function MetaAdsCard({ tenantId }: { tenantId: string | null }) {
  const [diag, setDiag] = useState<Diagnostico | null>(null)
  const [datasetId, setDatasetId] = useState('')
  const [token, setToken] = useState('')
  const [testEventCode, setTestEventCode] = useState('')
  const [ativo, setAtivo] = useState(false)
  const [acao, setAcao] = useState<'salvar' | 'testar' | 'reprocessar' | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    const res = await fetch('/api/empresa/meta')
    if (!res.ok) throw await erroDa(res, 'Erro ao carregar integração')
    const data: Diagnostico = await res.json()
    setDiag(data)
    setDatasetId(data.integracao?.datasetId ?? '')
    setTestEventCode(data.integracao?.testEventCode ?? '')
    setAtivo(data.integracao?.isActive ?? false)
  }, [])

  useEffect(() => {
    if (!tenantId) return
    carregar().catch((e) => setMensagem({ tipo: 'erro', texto: e.message }))
  }, [tenantId, carregar])

  const executar = async (tipo: NonNullable<typeof acao>, fn: () => Promise<string>) => {
    setAcao(tipo)
    setMensagem(null)
    try {
      setMensagem({ tipo: 'ok', texto: await fn() })
      await carregar()
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro' })
    } finally {
      setAcao(null)
    }
  }

  const salvar = () => executar('salvar', async () => {
    const res = await fetch('/api/empresa/meta', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId, testEventCode, isActive: ativo, ...(token && { token }) }),
    })
    if (!res.ok) throw await erroDa(res, 'Erro ao salvar')
    setToken('')
    return 'Configuração salva'
  })

  const testar = () => executar('testar', async () => {
    const res = await fetch('/api/empresa/meta/testar', { method: 'POST' })
    if (!res.ok) throw await erroDa(res, 'Erro ao testar')
    const data = await res.json()
    if (!data.ok) throw new Error(`Meta recusou: ${data.erro}`)
    return 'Evento de teste enviado — confira em Test Events no Events Manager'
  })

  const reprocessar = () => executar('reprocessar', async () => {
    const res = await fetch('/api/empresa/meta/reprocessar', { method: 'POST' })
    if (!res.ok) throw await erroDa(res, 'Erro ao reprocessar')
    const data = await res.json()
    return `${data.reprocessados} evento(s) de volta na fila`
  })

  const integ = diag?.integracao

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Meta Ads
          <Badge variant="outline">Superadmin</Badge>
        </CardTitle>
        <CardDescription>
          Envia Contact, Lead e Purchase dos leads de anúncio para a Meta (Conversions API).
          O Dataset precisa estar vinculado à conta do Instagram no Events Manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="meta-dataset">Dataset ID</Label>
            <Input id="meta-dataset" value={datasetId} inputMode="numeric"
              onChange={(e) => setDatasetId(e.target.value.trim())} className="mt-1 font-mono" />
          </div>
          <div>
            <Label htmlFor="meta-token">Token de acesso</Label>
            <Input id="meta-token" type="password" autoComplete="off" value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={integ?.tokenConfigurado ? '•••••• configurado (deixe vazio p/ manter)' : 'Cole o token'}
              className="mt-1" />
          </div>
          <div>
            <Label htmlFor="meta-test-code">Test event code</Label>
            <Input id="meta-test-code" value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              placeholder="Só durante a homologação" className="mt-1 font-mono" />
          </div>
          <div className="flex items-end gap-3 pb-2">
            <Switch id="meta-ativo" checked={ativo} onCheckedChange={setAtivo} />
            <Label htmlFor="meta-ativo">Envio ativo</Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={salvar} disabled={!!acao || !datasetId}>
            {acao === 'salvar' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={testar} disabled={!!acao || !integ?.tokenConfigurado}>
            {acao === 'testar'
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Send className="h-4 w-4 mr-2" />}
            Enviar evento de teste
          </Button>
          {!!diag?.contagem.failed && (
            <Button variant="outline" onClick={reprocessar} disabled={!!acao}>
              {acao === 'reprocessar'
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RotateCcw className="h-4 w-4 mr-2" />}
              Reprocessar falhas
            </Button>
          )}
        </div>

        {mensagem && (
          <p className={mensagem.tipo === 'erro' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {mensagem.texto}
          </p>
        )}

        {diag && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <Badge key={s} variant={s === 'failed' && diag.contagem[s] ? 'destructive' : 'secondary'}>
                  {STATUS_LABEL[s]}: {diag.contagem[s]}
                </Badge>
              ))}
            </div>

            {diag.eventos.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diag.eventos.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.event_name}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === 'failed' ? 'destructive' : e.status === 'sent' ? 'default' : 'secondary'}>
                          {STATUS_LABEL[e.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{e.attempts}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground" title={e.last_error ?? e.fbtraceId ?? ''}>
                        {e.last_error ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
