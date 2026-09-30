'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, Plus } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

type Usuario = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  tenant_id: string | null
  is_active: boolean
}

type ModoDono = 'existente' | 'novo'

const FORM_VAZIO = { name: '', max_users: '5', user_id: '', full_name: '', email: '' }

async function erroDa(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}))
  return new Error(data.error || fallback)
}

function EmpresasContent() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const superadmin = isSuperadmin(userProfile?.role)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [novaOpen, setNovaOpen] = useState(false)
  const [criando, setCriando] = useState(false)
  const [modo, setModo] = useState<ModoDono>('existente')
  const [form, setForm] = useState(FORM_VAZIO)

  useEffect(() => {
    if (userProfile && !isSuperadmin(userProfile.role)) router.push('/dashboard')
  }, [userProfile, router])

  const carregar = useCallback(async () => {
    try {
      setError(null)
      const [rEmpresas, rUsuarios] = await Promise.all([
        fetch('/api/admin/empresas'),
        fetch('/api/admin/users'),
      ])
      if (!rEmpresas.ok) throw await erroDa(rEmpresas, 'Erro ao carregar empresas')
      if (!rUsuarios.ok) throw await erroDa(rUsuarios, 'Erro ao carregar usuários')
      const [dEmpresas, dUsuarios] = await Promise.all([rEmpresas.json(), rUsuarios.json()])
      setEmpresas(dEmpresas.empresas || [])
      setUsuarios(dUsuarios.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (superadmin) carregar()
  }, [superadmin, carregar])

  const nomeEmpresa = (tenantId: string | null) =>
    empresas.find(e => e.id === tenantId)?.name ?? 'sem empresa'

  const rotuloUsuario = (u: Usuario) => {
    const nome = u.full_name || 'Sem nome'
    if (u.role === 'admin') {
      return u.id === userProfile?.id
        ? `${nome} (você — dono via acesso de superadmin)`
        : `${nome} (superadmin — dono via acesso de superadmin)`
    }
    const inativo = u.is_active ? '' : ' (inativo)'
    return `${nome} — ${u.email} · ${roleLabel[u.role] ?? u.role} · ${nomeEmpresa(u.tenant_id)}${inativo}`
  }

  const selecionado = usuarios.find(u => u.id === form.user_id)

  const fecharNova = (open: boolean) => {
    if (open || criando) return
    setNovaOpen(false)
    setForm(FORM_VAZIO)
    setModo('existente')
  }

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    const max_users = Number(form.max_users)
    if (!name) {
      alert('Nome da empresa é obrigatório')
      return
    }
    if (!Number.isInteger(max_users) || max_users < 1) {
      alert('Slots deve ser um número inteiro ≥ 1')
      return
    }
    let dono: { user_id: string } | { email: string; full_name: string }
    if (modo === 'existente') {
      if (!form.user_id) {
        alert('Selecione o dono')
        return
      }
      dono = { user_id: form.user_id }
    } else {
      const email = form.email.trim()
      const full_name = form.full_name.trim()
      if (!email || !full_name) {
        alert('Nome e email do dono são obrigatórios')
        return
      }
      dono = { email, full_name }
    }

    try {
      setCriando(true)
      const response = await fetch('/api/admin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, max_users, dono }),
      })
      if (!response.ok) throw await erroDa(response, 'Erro ao criar empresa')
      const data = await response.json()
      invalidarCacheEmpresas()
      setNovaOpen(false)
      setForm(FORM_VAZIO)
      setModo('existente')
      await carregar()
      if ('email' in dono) {
        alert(data.dono?.reaproveitado
          ? 'Usuário existente vinculado como dono — ele entra com a senha atual.'
          : `Convite enviado para ${dono.email}`)
      } else {
        alert(`Empresa "${name}" criada`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar empresa')
    } finally {
      setCriando(false)
    }
  }

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
          <h1 className="text-3xl font-bold">Empresas</h1>
          <p className="text-muted-foreground mt-1">Gerencie as empresas que usam o CRM</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Empresas
                <Badge variant="secondary">{empresas.length}</Badge>
              </CardTitle>
              <CardDescription>Todas as empresas cadastradas</CardDescription>
            </div>
            <Button onClick={() => setNovaOpen(true)} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Nova empresa
            </Button>
          </CardHeader>

          <CardContent>
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

            {!loading && !error && empresas.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma empresa cadastrada</h3>
              </div>
            )}

            {!loading && !error && empresas.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Donos</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell>
                        {e.donos.length
                          ? e.donos.map(d => d.full_name || 'Sem nome').join(', ')
                          : <span className="text-muted-foreground">Superadmin</span>}
                      </TableCell>
                      <TableCell>{e.ativos}/{e.max_users}</TableCell>
                      <TableCell>
                        {e.is_active
                          ? <Badge variant="default">Ativa</Badge>
                          : <Badge variant="secondary">Inativa</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/admin/empresas/${e.id}`)}>
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={novaOpen} onOpenChange={fecharNova}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
            <DialogDescription>Cadastre a empresa e defina quem será o dono.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCriar} className="space-y-4">
            <div>
              <Label htmlFor="empresa-nome">Nome *</Label>
              <Input id="empresa-nome" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Empresa Exemplo" />
            </div>
            <div>
              <Label htmlFor="empresa-slots">Slots de usuários *</Label>
              <Input id="empresa-slots" type="number" min={1} step={1} value={form.max_users}
                onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Dono *</Label>
              <Tabs value={modo} onValueChange={(v) => setModo(v as ModoDono)}>
                <TabsList>
                  <TabsTrigger value="existente">Usuário existente</TabsTrigger>
                  <TabsTrigger value="novo">Convidar novo</TabsTrigger>
                </TabsList>
                <TabsContent value="existente" className="space-y-2">
                  <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                    <SelectTrigger aria-label="Usuário existente">
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {rotuloUsuario(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selecionado && selecionado.role !== 'admin' && (
                    <p className="text-xs text-muted-foreground">
                      O usuário será MOVIDO para a nova empresa. Os leads dele continuam na empresa anterior.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="novo" className="space-y-3">
                  <div>
                    <Label htmlFor="dono-nome">Nome *</Label>
                    <Input id="dono-nome" value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="João Silva" />
                  </div>
                  <div>
                    <Label htmlFor="dono-email">Email *</Label>
                    <Input id="dono-email" type="email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="dono@exemplo.com" />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => fecharNova(false)} disabled={criando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criando}>
                {criando
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                  : <><Plus className="h-4 w-4 mr-2" />Criar empresa</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

export default function EmpresasPage() {
  return (
    <ProtectedRoute>
      <EmpresasContent />
    </ProtectedRoute>
  )
}
