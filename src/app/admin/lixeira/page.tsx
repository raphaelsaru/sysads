'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ItemLixeira } from '@/app/api/admin/lixeira/route'

const TIPOS = [
  { valor: 'leads', label: 'Leads' },
  { valor: 'negociacoes', label: 'Negociações' },
  { valor: 'followups', label: 'Follow-ups' },
] as const

async function erroDa(res: Response, padrao: string) {
  const data = await res.json().catch(() => ({}))
  return new Error(data.error || padrao)
}

function quando(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function LixeiraPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Lixeira />
      </MainLayout>
    </ProtectedRoute>
  )
}

function Lixeira() {
  const [tipo, setTipo] = useState<string>('leads')
  const [empresa, setEmpresa] = useState('todas')
  const [empresas, setEmpresas] = useState<{ id: string; name: string }[]>([])
  const [itens, setItens] = useState<ItemLixeira[]>([])
  const [proximo, setProximo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [paraExcluir, setParaExcluir] = useState<ItemLixeira | null>(null)

  useEffect(() => {
    fetch('/api/admin/empresas')
      .then(r => (r.ok ? r.json() : { empresas: [] }))
      .then(d => setEmpresas(d.empresas || []))
      .catch(() => {})
  }, [])

  const buscar = useCallback(async (antes?: string) => {
    const params = new URLSearchParams({ tipo })
    if (empresa !== 'todas') params.set('tenant', empresa)
    if (antes) params.set('antes', antes)
    const res = await fetch(`/api/admin/lixeira?${params.toString()}`)
    if (!res.ok) throw await erroDa(res, 'Erro ao carregar lixeira')
    return (await res.json()) as { itens: ItemLixeira[]; proximo: string | null }
  }, [tipo, empresa])

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const d = await buscar()
      setItens(d.itens)
      setProximo(d.proximo)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar lixeira')
    } finally {
      setLoading(false)
    }
  }, [buscar])

  useEffect(() => { void recarregar() }, [recarregar])

  const carregarMais = async () => {
    if (!proximo) return
    try {
      const d = await buscar(proximo)
      setItens(prev => [...prev, ...d.itens])
      setProximo(d.proximo)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao carregar mais')
    }
  }

  const restaurar = async (item: ItemLixeira) => {
    setOcupado(item.id)
    try {
      const res = await fetch('/api/admin/lixeira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: item.tipo, id: item.id }),
      })
      if (!res.ok) throw await erroDa(res, 'Erro ao restaurar')
      setItens(prev => prev.filter(i => i.id !== item.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao restaurar')
    } finally {
      setOcupado(null)
    }
  }

  const excluirDefinitivo = async () => {
    const item = paraExcluir
    if (!item) return
    setParaExcluir(null)
    setOcupado(item.id)
    try {
      const res = await fetch(`/api/admin/lixeira?tipo=${item.tipo}&id=${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw await erroDa(res, 'Erro ao excluir')
      setItens(prev => prev.filter(i => i.id !== item.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Badge variant="muted" className="w-fit bg-primary/10 text-primary">Superadmin</Badge>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Lixeira</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Itens que os usuários excluíram. Para eles sumiram; aqui dá para restaurar ou apagar de vez.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando lixeira
        </div>
      ) : erro ? (
        <Card><CardHeader><CardTitle className="text-lg">{erro}</CardTitle></CardHeader></Card>
      ) : itens.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lixeira vazia</CardTitle>
            <CardDescription>Nenhum item excluído com esses filtros.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <ul className="divide-y divide-border">
              {itens.map(item => (
                <li key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold">
                      {item.titulo}
                      {item.lead_excluido && <span className="ml-2 text-xs font-normal text-muted-foreground">(lead também excluído)</span>}
                    </p>
                    {item.detalhe && <p className="truncate text-xs text-muted-foreground">{item.detalhe}</p>}
                    <p className="text-xs text-muted-foreground">
                      {[item.empresa, item.responsavel && `Responsável: ${item.responsavel}`].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Excluído {item.excluido_por ? `por ${item.excluido_por} ` : ''}em {quando(item.excluido_em)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" disabled={ocupado === item.id} onClick={() => { void restaurar(item) }}>
                      {ocupado === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                      Restaurar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      disabled={ocupado === item.id} onClick={() => setParaExcluir(item)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir de vez
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {proximo && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => { void carregarMais() }}>Carregar mais</Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!paraExcluir} onOpenChange={(open) => !open && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-destructive">Não pode ser desfeito.</span>{' '}
              {paraExcluir?.tipo === 'leads'
                ? <>O lead <span className="font-semibold text-foreground">{paraExcluir?.titulo}</span> e todas as negociações dele serão apagados do banco.</>
                : <>Este item de <span className="font-semibold text-foreground">{paraExcluir?.titulo}</span> será apagado do banco.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { void excluirDefinitivo() }}>
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
