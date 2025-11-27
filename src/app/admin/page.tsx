'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Eye, Shield, Mail, Building2, Calendar, Loader2, X, Plus, Instagram, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface User {
  id: string
  email: string
  company_name: string
  currency: string
  role: string
  created_at: string
}

interface TenantWithFeatures {
  id: string
  name: string
  slug: string
  settings: {
    ocr_instagram_enabled?: boolean
  }
}

function AdminPageContent() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const { impersonatedUser, startImpersonation, stopImpersonation } = useAdmin()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([])
  const [tenantsWithFeatures, setTenantsWithFeatures] = useState<TenantWithFeatures[]>([])
  const [loadingFeatures, setLoadingFeatures] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'tenant_user' as 'admin_global' | 'tenant_admin' | 'tenant_user',
    tenant_id: '',
  })

  // Verificar se é admin global
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin_global') {
      router.push('/dashboard')
    }
  }, [userProfile, router])

  // Carregar tenants para o select
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await fetch('/api/admin/tenants')
        if (response.ok) {
          const data = await response.json()
          const tenantsList = data.tenants || []
          
          // Garantir que settings existe em cada tenant
          const tenantsWithSettings = tenantsList.map((tenant: any) => ({
            ...tenant,
            settings: tenant.settings || {},
          }))
          
          console.log('📋 Tenants carregados:', tenantsWithSettings)
          setTenants(tenantsWithSettings)
          setTenantsWithFeatures(tenantsWithSettings)
        }
      } catch (err) {
        console.error('Erro ao carregar tenants:', err)
      }
    }

    if (userProfile?.role === 'admin_global') {
      fetchTenants()
    }
  }, [userProfile])

  // Carregar usuários
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/admin/users')
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao carregar usuários')
        }

        const data = await response.json()
        setUsers(data.users || [])
      } catch (err) {
        console.error('Erro ao carregar usuários:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    if (userProfile?.role === 'admin_global') {
      fetchUsers()
    }
  }, [userProfile])

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      alert('Email, senha e nome completo são obrigatórios')
      return
    }

    if (newUser.role !== 'admin_global' && !newUser.tenant_id) {
      alert('Tenant é obrigatório para roles tenant_admin e tenant_user')
      return
    }

    try {
      setCreating(true)

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar usuário')
      }

      const data = await response.json()
      
      // Adicionar à lista
      setUsers([data.user, ...users])
      setCreateDialogOpen(false)
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        role: 'tenant_user',
        tenant_id: '',
      })
      alert('Usuário criado com sucesso!')
    } catch (err) {
      console.error('Erro ao criar usuário:', err)
      alert(err instanceof Error ? err.message : 'Erro ao criar usuário')
    } finally {
      setCreating(false)
    }
  }

  const handleImpersonate = (user: User) => {
    startImpersonation({
      id: user.id,
      email: user.email,
      company_name: user.company_name,
      currency: user.currency,
    })
    router.push('/dashboard')
  }

  const handleStopImpersonation = () => {
    stopImpersonation()
  }

  const handleToggleOCRFeature = async (tenantId: string, currentValue: boolean) => {
    try {
      setLoadingFeatures(true)
      
      const newValue = !currentValue
      console.log('🔄 Toggling OCR feature:', { tenantId, currentValue, newValue })
      
      const response = await fetch('/api/admin/tenant-features', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          ocr_instagram_enabled: newValue,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Erro na resposta:', errorData)
        throw new Error(errorData.error || 'Erro ao atualizar feature')
      }

      const result = await response.json()
      console.log('✅ Feature atualizada:', result)

      // Atualizar estado local
      setTenantsWithFeatures(prev =>
        prev.map(tenant => {
          if (tenant.id === tenantId) {
            const updatedTenant = {
              ...tenant,
              settings: {
                ...(tenant.settings || {}),
                ocr_instagram_enabled: newValue,
              },
            }
            console.log('📝 Tenant atualizado no estado:', updatedTenant)
            return updatedTenant
          }
          return tenant
        })
      )

      // Recarregar tenants para garantir sincronização
      const refreshResponse = await fetch('/api/admin/tenants')
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setTenantsWithFeatures(refreshData.tenants || [])
      }

      alert(`Feature OCR Instagram ${newValue ? 'habilitada' : 'desabilitada'} com sucesso!`)
    } catch (err) {
      console.error('❌ Erro ao atualizar feature:', err)
      alert(err instanceof Error ? err.message : 'Erro ao atualizar feature')
    } finally {
      setLoadingFeatures(false)
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
                Você não tem permissão para acessar esta área.
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Painel de Administração</h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie usuários e visualize o sistema como qualquer usuário
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Usuário
          </Button>
        </div>

        {/* Banner de Impersonação */}
        {impersonatedUser && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
                  <Eye className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold">Modo de Visualização Ativo</p>
                  <p className="text-sm text-muted-foreground">
                    Você está vendo o sistema como{' '}
                    <strong>{impersonatedUser.company_name}</strong> ({impersonatedUser.email})
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStopImpersonation}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Sair da Visualização
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Lista de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários do Sistema
            </CardTitle>
            <CardDescription>
              Total de {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <Card
                    key={user.id}
                    className="border-border/70 transition-all hover:shadow-md"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Info do Usuário */}
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  {user.company_name || 'Sem nome'}
                                </h3>
                                {user.role === 'admin_global' && (
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <Shield className="h-3 w-3" />
                                    Super Admin
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {user.currency}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>

                          {/* Informações Adicionais */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Criado em {format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </div>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex flex-col gap-2">
                          {user.role !== 'admin_global' && (
                            <Button
                              onClick={() => handleImpersonate(user)}
                              variant="outline"
                              size="sm"
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Visualizar como
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gerenciamento de Features dos Tenants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gerenciamento de Features
            </CardTitle>
            <CardDescription>
              Habilite ou desabilite features para cada tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFeatures ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : tenantsWithFeatures.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum tenant encontrado
              </div>
            ) : (
              <div className="space-y-3">
                {tenantsWithFeatures.map((tenant) => (
                  <Card
                    key={tenant.id}
                    className="border-border/70 transition-all hover:shadow-md"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{tenant.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                @{tenant.slug}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Features */}
                        <div className="flex items-center gap-6">
                          {/* OCR Instagram */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Instagram className="h-4 w-4" />
                                OCR Instagram
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {tenant.settings?.ocr_instagram_enabled
                                  ? 'Habilitada'
                                  : 'Desabilitada'}
                              </p>
                            </div>
                            <Switch
                              checked={Boolean(tenant.settings?.ocr_instagram_enabled)}
                              onCheckedChange={(checked) => {
                                console.log('🔄 Switch clicado:', { tenantId: tenant.id, checked })
                                handleToggleOCRFeature(
                                  tenant.id,
                                  Boolean(tenant.settings?.ocr_instagram_enabled)
                                )
                              }}
                              disabled={loadingFeatures}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Criar Usuário */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Crie um novo usuário no sistema. Você pode criar super admins, admins de tenant ou usuários comuns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="usuario@exemplo.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="João Silva"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: 'admin_global' | 'tenant_admin' | 'tenant_user') => 
                    setNewUser({ ...newUser, role: value, tenant_id: value === 'admin_global' ? '' : newUser.tenant_id })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Selecione a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin_global">Super Admin</SelectItem>
                    <SelectItem value="tenant_admin">Admin do Tenant</SelectItem>
                    <SelectItem value="tenant_user">Usuário Comum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newUser.role !== 'admin_global' && (
                <div>
                  <Label htmlFor="tenant_id">Tenant *</Label>
                  <Select
                    value={newUser.tenant_id}
                    onValueChange={(value) => setNewUser({ ...newUser, tenant_id: value })}
                  >
                    <SelectTrigger id="tenant_id">
                      <SelectValue placeholder="Selecione o tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminPageContent />
    </ProtectedRoute>
  )
}
