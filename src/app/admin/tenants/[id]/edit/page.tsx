'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Loader2, XCircle } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tenant, UpdateTenantInput } from '@/types/crm'
import ColorPicker from '@/components/onboarding/ColorPicker'

function TenantEditPageContent() {
  const router = useRouter()
  const params = useParams()
  const { userProfile } = useAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<UpdateTenantInput>({
    name: '',
    description: '',
    max_clients: 1000,
    max_users: 10,
    is_active: true,
    branding: {
      companyName: '',
      primaryColor: '#3b82f6',
      secondaryColor: '#8b5cf6',
      logo: null,
    },
  })

  const tenantId = params?.id as string

  // Verificar se é super admin
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin_global') {
      router.push('/dashboard')
    }
  }, [userProfile, router])

  // Carregar tenant
  useEffect(() => {
    const fetchTenant = async () => {
      if (!tenantId || userProfile?.role !== 'admin_global') return

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/admin/tenants/${tenantId}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao carregar tenant')
        }

        const data = await response.json()
        const tenantData = data.tenant as Tenant
        
        setTenant(tenantData)
        setFormData({
          name: tenantData.name || '',
          description: tenantData.description || '',
          max_clients: tenantData.max_clients || 1000,
          max_users: tenantData.max_users || 10,
          is_active: tenantData.is_active ?? true,
          branding: {
            companyName: tenantData.branding?.companyName || tenantData.name || '',
            primaryColor: tenantData.branding?.primaryColor || '#3b82f6',
            secondaryColor: tenantData.branding?.secondaryColor || '#8b5cf6',
            logo: tenantData.branding?.logo || null,
          },
        })
      } catch (err) {
        console.error('Erro ao carregar tenant:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    if (userProfile?.role === 'admin_global') {
      fetchTenant()
    }
  }, [tenantId, userProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tenant) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar tenant')
      }

      await response.json()
      
      // Redirecionar para a página de detalhes
      router.push(`/admin/tenants/${tenant.id}`)
    } catch (err) {
      console.error('Erro ao atualizar tenant:', err)
      setError(err instanceof Error ? err.message : 'Erro ao atualizar tenant')
    } finally {
      setSaving(false)
    }
  }

  if (userProfile?.role !== 'admin_global') {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando tenant...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error && !tenant) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h1 className="mb-2 text-xl font-semibold">Erro ao carregar tenant</h1>
              <p className="text-sm text-muted-foreground mb-4">
                {error}
              </p>
              <Button onClick={() => router.push('/admin/tenants')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para lista
              </Button>
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
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/tenants/${tenantId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Editar Tenant</h1>
              <p className="text-muted-foreground mt-1">
                Atualize as informações do tenant
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Dados principais do tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Empresa *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Acme Corp"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional..."
                    rows={4}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active">Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {formData.is_active ? 'Tenant ativo' : 'Tenant inativo'}
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Limites */}
            <Card>
              <CardHeader>
                <CardTitle>Limites e Capacidade</CardTitle>
                <CardDescription>Configurações de limites do tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="max_users">Máximo de Usuários</Label>
                  <Input
                    id="max_users"
                    type="number"
                    min="1"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Número máximo de usuários que podem ser criados neste tenant
                  </p>
                </div>
                <div>
                  <Label htmlFor="max_clients">Máximo de Clientes</Label>
                  <Input
                    id="max_clients"
                    type="number"
                    min="1"
                    value={formData.max_clients}
                    onChange={(e) => setFormData({ ...formData, max_clients: parseInt(e.target.value) || 1000 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Número máximo de clientes que podem ser cadastrados neste tenant
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Branding */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Identidade visual do tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Nome da Empresa (Branding)</Label>
                  <Input
                    id="companyName"
                    value={formData.branding?.companyName || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      branding: {
                        ...formData.branding,
                        companyName: e.target.value,
                      },
                    })}
                    placeholder="Nome exibido no sistema"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <ColorPicker
                    id="primaryColor"
                    label="Cor Primária"
                    value={formData.branding?.primaryColor || '#3b82f6'}
                    onChange={(color) => setFormData({
                      ...formData,
                      branding: {
                        ...formData.branding,
                        primaryColor: color,
                      },
                    })}
                  />
                  <ColorPicker
                    id="secondaryColor"
                    label="Cor Secundária"
                    value={formData.branding?.secondaryColor || '#8b5cf6'}
                    onChange={(color) => setFormData({
                      ...formData,
                      branding: {
                        ...formData.branding,
                        secondaryColor: color,
                      },
                    })}
                  />
                </div>
                {formData.branding?.logo && (
                  <div>
                    <Label>Logo Atual</Label>
                    <div className="mt-2">
                      <img
                        src={formData.branding.logo}
                        alt="Logo"
                        className="h-16 w-auto object-contain border rounded p-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Para alterar o logo, use a página de configurações do tenant
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/tenants/${tenantId}`)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}

export default function TenantEditPage() {
  return (
    <ProtectedRoute>
      <TenantEditPageContent />
    </ProtectedRoute>
  )
}

