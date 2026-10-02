'use client'

import { useCallback, useEffect, useState } from 'react'
import { Crown, Loader2, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Dono } from '@/lib/donos'

type Membro = { id: string; nome: string; role: string; is_active: boolean }

async function erroDa(res: Response, padrao: string) {
  const data = await res.json().catch(() => ({}))
  return new Error(data.error || padrao)
}

// Donos da empresa (membros + vinculados de outras empresas). Usado em /empresa (dono)
// e /admin/empresas/[id] (superadmin); `endpoint` aponta p/ a API de cada um.
export default function CardDonos({ endpoint, membros, onAlterado }: {
  endpoint: string
  membros: Membro[]            // membros da empresa (p/ promover)
  onAlterado?: () => void      // recarregar a lista de usuários da página
}) {
  const [donos, setDonos] = useState<Dono[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [promoverId, setPromoverId] = useState('')
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setErro(null)
      const res = await fetch(endpoint)
      if (!res.ok) throw await erroDa(res, 'Erro ao carregar donos')
      setDonos(((await res.json()).donos || []) as Dono[])
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar donos')
    } finally {
      setCarregando(false)
    }
  }, [endpoint])

  useEffect(() => { void carregar() }, [carregar])

  const adicionar = async (corpo: Record<string, string>) => {
    setSalvando(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      if (!res.ok) throw await erroDa(res, 'Erro ao adicionar dono')
      const data = await res.json()
      setPromoverId('')
      setEmail('')
      setNome('')
      await carregar()
      onAlterado?.()
      if (data.resultado === 'convidado') alert('Convite de dono enviado por email.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar dono')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (d: Dono) => {
    const quem = d.full_name || d.email || 'este dono'
    const msg = d.origem === 'vinculado'
      ? `Remover o acesso de dono de ${quem} a esta empresa?`
      : `Remover ${quem} como dono? Ele continua na empresa como Artista.`
    if (!confirm(msg)) return
    setRemovendo(d.user_id)
    try {
      const res = await fetch(`${endpoint}?user_id=${encodeURIComponent(d.user_id)}`, { method: 'DELETE' })
      if (!res.ok) throw await erroDa(res, 'Erro ao remover dono')
      await carregar()
      onAlterado?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover dono')
    } finally {
      setRemovendo(null)
    }
  }

  const candidatos = membros.filter(m => m.is_active && m.role !== 'owner' && m.role !== 'admin')
  const ativos = donos.filter(d => d.is_active).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Donos
          <Badge variant="secondary">{donos.length}</Badge>
        </CardTitle>
        <CardDescription>
          Uma empresa pode ter vários donos, e um dono pode ter várias empresas. Donos de outras empresas não ocupam vaga.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando donos
          </div>
        ) : erro ? (
          <p className="text-sm text-destructive">{erro}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {donos.map(d => (
              <li key={d.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {d.full_name || 'Sem nome'}
                    {!d.is_active && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.email || '-'} · {d.origem === 'vinculado' ? 'dono de outra empresa' : 'desta empresa'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${d.full_name || 'dono'}`}
                  disabled={removendo === d.user_id || (d.is_active && ativos <= 1)}
                  title={d.is_active && ativos <= 1 ? 'A empresa precisa de pelo menos 1 dono' : undefined}
                  onClick={() => { void remover(d) }}
                >
                  {removendo === d.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Tornar dono um membro da equipe</Label>
            <Select value={promoverId} onValueChange={setPromoverId} disabled={candidatos.length === 0}>
              <SelectTrigger className="w-64" aria-label="Membro">
                <SelectValue placeholder={candidatos.length ? 'Selecione' : 'Nenhum membro disponível'} />
              </SelectTrigger>
              <SelectContent>
                {candidatos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" disabled={salvando || !promoverId} onClick={() => { void adicionar({ user_id: promoverId }) }}>
            Tornar dono
          </Button>
        </div>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); void adicionar(nome.trim() ? { email, full_name: nome } : { email }) }}
        >
          <div className="space-y-1">
            <Label htmlFor="dono-email">Ou por email</Label>
            <Input id="dono-email" type="email" className="w-64" placeholder="dono@empresa.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dono-nome">Nome (se for convite novo)</Label>
            <Input id="dono-nome" className="w-56" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={salvando || !email.trim()}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar dono
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Email de dono de outra empresa: vincula. Email novo: envia convite de dono (ocupa vaga).
        </p>
      </CardContent>
    </Card>
  )
}
