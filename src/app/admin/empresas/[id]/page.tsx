'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Loader2, Users } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { isSuperadmin, roleLabel } from '@/lib/roles'
import { invalidarCacheEmpresas } from '@/components/layout/EmpresaSwitcher'
import type { UserRole } from '@/types/crm'

type Empresa = {
  id: string
  name: string
  slug: string
  max_users: number
  is_active: boolean
  created_at: string
  ativos: number
  donos: { id: string; full_name: string | null }[]
}

type Membro = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  tenant_id: string | null
  is_active: boolean
}

async function erroDa(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}))
  return new Error(data.error || fallback)
}

function EmpresaDetalheContent() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const { userProfile, refreshProfile } = useAuth()
  const superadmin = isSuperadmin(userProfile?.role)

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', max_users: '' })
  const [salvando, setSalvando] = useState(false)
  const [salvandoAtivo, setSalvandoAtivo] = useState(false)
  const [donoId, setDonoId] = useState('')
  const [definindoDono, setDefinindoDono] = useState(false)
  const [abrindo, setAbrindo] = useState(false)

  useEffect(() => {
    if (userProfile && !isSuperadmin(userProfile.role)) router.push('/dashboard')
  }, [userProfile, router])

  // recarga: após ação bem-sucedida — se falhar, avisa e mantém os dados atuais.
  const carregar = useCallback(async (recarga = false) => {
    try {
      if (!recarga) setError(null)
      const [rEmpresas, rUsuarios] = await Promise.all([
        fetch('/api/admin/empresas'),
        fetch('/api/admin/users'),
      ])
      if (!rEmpresas.ok) throw await erroDa(rEmpresas, 'Erro ao carregar empresa')
      if (!rUsuarios.ok) throw await erroDa(rUsuarios, 'Erro ao carregar usuários')
      const [dEmpresas, dUsuarios] = await Promise.all([rEmpresas.json(), rUsuarios.json()])
      const encontrada = ((dEmpresas.empresas || []) as Empresa[]).find(e => e.id === id) ?? null
      if (!encontrada) throw new Error('Empresa não encontrada')
      const doTenant = ((dUsuarios.users || []) as Membro[]).filter(u => u.tenant_id === id)
      setEmpresa(encontrada)
      setMembros(doTenant)
      setForm({ name: encontrada.name, max_users: String(encontrada.max_users) })
      const dono = doTenant.find(u => u.role === 'owner')
      setDonoId(dono && dono.is_active ? dono.id : '')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      if (recarga) alert(`Alteração salva, mas falhou ao recarregar: ${msg}`)
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (superadmin && id) carregar()
  }, [superadmin, id, carregar])

  const patch = async (body: Record<string, unknown>, fallback: string) => {
    const response = await fetch(`/api/admin/empresas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw await erroDa(response, fallback)
    return response.json()
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    const max_users = Number(form.max_users)
    if (!name) {
      alert('Nome é obrigatório')
      return
    }
    if (!Number.isInteger(max_users) || max_users < 1) {
      alert('Slots deve ser um número inteiro ≥ 1')
      return
    }
    try {
      setSalvando(true)
      await patch({ name, max_users }, 'Erro ao salvar empresa')
      invalidarCacheEmpresas()
      await carregar(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar empresa')
    } finally {
      setSalvando(false)
    }
  }

  const handleAtivo = async (ativo: boolean) => {
    if (!empresa) return
    try {
      setSalvandoAtivo(true)
      setEmpresa({ ...empresa, is_active: ativo })
      await patch({ is_active: ativo }, 'Erro ao atualizar empresa')
      invalidarCacheEmpresas()
    } catch (err) {
      setEmpresa(prev => (prev ? { ...prev, is_active: !ativo } : prev))
      alert(err instanceof Error ? err.message : 'Erro ao atualizar empresa')
    } finally {
      setSalvandoAtivo(false)
    }
  }

  const handleDefinirDono = async () => {
    if (!donoId) return
    try {
      setDefinindoDono(true)
      await patch({ owner_id: donoId }, 'Erro ao definir dono')
      await carregar(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao definir dono')
    } finally {
      setDefinindoDono(false)
    }
  }

  const handleGerenciar = async () => {
    try {
      setAbrindo(true)
      const response = await fetch('/api/admin/empresa-ativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: id }),
      })
      if (!response.ok) throw await erroDa(response, 'Erro ao trocar de empresa')
      await refreshProfile()
      router.push('/empresa')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao trocar de empresa')
      setAbrindo(false)
    }
  }

  const propria = userProfile?.tenant_id === id
  const candidatosDono = membros.filter(m => m.is_active && m.role !== 'admin')
  const donoAtual = candidatosDono.find(m => m.role === 'owner')?.id ?? ''

  if (!userProfile) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    )
  }

  if (!superadmin) return null

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/admin/empresas')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Empresas
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{empresa?.name ?? 'Empresa'}</h1>
              {empresa && (
                <p className="text-muted-foreground mt-1">
                  {empresa.ativos}/{empresa.max_users} usuários ativos
                </p>
              )}
            </div>
            <Button onClick={handleGerenciar} disabled={!empresa || abrindo}>
              {abrindo
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Users className="h-4 w-4 mr-2" />}
              Gerenciar usuários
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && empresa && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Dados da empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSalvar} className="flex flex-wrap items-end gap-4">
                  <div>
                    <Label htmlFor="empresa-nome">Nome</Label>
                    <Input id="empresa-nome" className="mt-1 w-64" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="empresa-slots">Slots</Label>
                    <Input id="empresa-slots" className="mt-1 w-28" type="number" min={1} step={1}
                      value={form.max_users}
                      onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
                  </div>
                  <Button type="submit" disabled={salvando}>
                    {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </form>

                <div className="flex items-center gap-3">
                  <Switch
                    id="empresa-ativa"
                    checked={empresa.is_active}
                    disabled={salvandoAtivo || propria}
                    onCheckedChange={handleAtivo}
                  />
                  <Label htmlFor="empresa-ativa">Empresa ativa</Label>
                  {propria && (
                    <span className="text-xs text-muted-foreground">Sua empresa não pode ser desativada</span>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <Label>Dono</Label>
                    <Select value={donoId} onValueChange={setDonoId}>
                      <SelectTrigger className="mt-1 w-72" aria-label="Dono">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidatosDono.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name || 'Sem nome'} — {m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDefinirDono}
                    disabled={definindoDono || !donoId || donoId === donoAtual}
                  >
                    {definindoDono && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Definir dono
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Membros
                  <Badge variant="secondary">{membros.length}</Badge>
                </CardTitle>
                <CardDescription>Para convidar ou desativar, use &quot;Gerenciar usuários&quot;</CardDescription>
              </CardHeader>
              <CardContent>
                {membros.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum membro</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membros.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.full_name || 'Sem nome'}</TableCell>
                          <TableCell>{m.email || '-'}</TableCell>
                          <TableCell>{roleLabel[m.role] ?? m.role}</TableCell>
                          <TableCell>
                            {m.is_active
                              ? <Badge variant="default">Ativo</Badge>
                              : <Badge variant="secondary">Inativo</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}

export default function EmpresaDetalhePage() {
  return (
    <ProtectedRoute>
      <EmpresaDetalheContent />
    </ProtectedRoute>
  )
}
