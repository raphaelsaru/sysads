'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Building2, Users, Database, Calendar, Eye, Edit, Ban } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TenantStatistics } from '@/types/crm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function TenantsPageContent() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const [tenants, setTenants] = useState<TenantStatistics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    description: '',
    max_clients: 1000,
    max_users: 10,
  })

  // Verificar se é super admin
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin_global') {
      router.push('/dashboard')
    }
  }, [userProfile, router])

  // Carregar tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/admin/tenants')
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao carregar tenants')
        }

        const data = await response.json()
        setTenants(data.tenants || [])
      } catch (err) {
        console.error('Erro ao carregar tenants:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    if (userProfile?.role === 'admin_global') {
      fetchTenants()
    }
  }, [userProfile])

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug) {
      alert('Nome e slug são obrigatórios')
      return
    }

    try {
      setCreating(true)

      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTenant),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar tenant')
      }

      const data = await response.json()
      setTenants([data.tenant, ...tenants])
      setCreateDialogOpen(false)
      setNewTenant({
        name: '',
        slug: '',
        description: '',
        max_clients: 1000,
        max_users: 10,
      })
    } catch (err) {
      console.error('Erro ao criar tenant:', err)
      alert(err instanceof Error ? err.message : 'Erro ao criar tenant')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (tenant: TenantStatistics) => {
    if (!confirm(`Tem certeza que deseja ${tenant.is_active ? 'desativar' : 'ativar'} este tenant?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !tenant.is_active }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar tenant')
      }

      // Atualizar lista
      setTenants(tenants.map(t => 
        t.id === tenant.id ? { ...t, is_active: !t.is_active } : t
      ))
    } catch (err) {
      console.error('Erro ao atualizar tenant:', err)
      alert('Erro ao atualizar tenant')
    }
  }

  if (userProfile?.role !== 'admin_global') {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <Badge variant="destructive" className="mb-4">Acesso Restrito</Badge>
              <h1 className="mb-2 text-xl font-semibold">Acesso Negado</h1>
              <p className="text-sm text-muted-foreground">
                Apenas super admins podem acessar esta área.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Tenants</h1>
            <p className="text-muted-foreground mt-1">
              Gerenciar empresas que usam o sistema Prizely
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Tenant
          </Button>
        </div>

        {/* Loading / Error */}
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

        {/* Tenants Grid */}
        {!loading && !error && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tenants.map((tenant) => (
              <Card key={tenant.id} className={!tenant.is_active ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {tenant.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {tenant.slug}
                      </CardDescription>
                    </div>
                    <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                      {tenant.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tenant.description && (
                    <p className="text-sm text-muted-foreground">
                      {tenant.description}
                    </p>
                  )}

                  {/* Estatísticas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>{tenant.total_users}</strong> / {tenant.max_users} usuários
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>{tenant.total_clients}</strong> / {tenant.max_clients} clientes
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Criado em {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant={tenant.is_active ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => handleToggleActive(tenant)}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && tenants.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum tenant cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro tenant para começar
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Tenant
            </Button>
          </div>
        )}
      </div>

      {/* Dialog de Criar Tenant */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Tenant</DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa que usará o sistema Prizely
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={newTenant.slug}
                onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="acme-corp"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Apenas letras minúsculas, números e hífens
              </p>
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={newTenant.description}
                onChange={(e) => setNewTenant({ ...newTenant, description: e.target.value })}
                placeholder="Descrição opcional..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_users">Máx. Usuários</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={newTenant.max_users}
                  onChange={(e) => setNewTenant({ ...newTenant, max_users: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="max_clients">Máx. Clientes</Label>
                <Input
                  id="max_clients"
                  type="number"
                  value={newTenant.max_clients}
                  onChange={(e) => setNewTenant({ ...newTenant, max_clients: parseInt(e.target.value) || 1000 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTenant} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

export default function TenantsPage() {
  return (
    <ProtectedRoute>
      <TenantsPageContent />
    </ProtectedRoute>
  )
}







