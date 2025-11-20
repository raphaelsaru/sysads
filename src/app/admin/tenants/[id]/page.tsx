'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Building2, Users, Database, Calendar, Edit, Ban, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tenant } from '@/types/crm'
import { Separator } from '@/components/ui/separator'

function TenantDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const { userProfile } = useAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

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
        setTenant(data.tenant)
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

  const handleToggleActive = async () => {
    if (!tenant) return

    if (!confirm(`Tem certeza que deseja ${tenant.is_active ? 'desativar' : 'ativar'} este tenant?`)) {
      return
    }

    try {
      setToggling(true)

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

      const data = await response.json()
      setTenant(data.tenant)
    } catch (err) {
      console.error('Erro ao atualizar tenant:', err)
      alert('Erro ao atualizar tenant')
    } finally {
      setToggling(false)
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

  if (error || !tenant) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h1 className="mb-2 text-xl font-semibold">Erro ao carregar tenant</h1>
              <p className="text-sm text-muted-foreground mb-4">
                {error || 'Tenant não encontrado'}
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
              onClick={() => router.push('/admin/tenants')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Building2 className="h-8 w-8" />
                {tenant.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                Detalhes do tenant
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              variant={tenant.is_active ? 'destructive' : 'default'}
              onClick={handleToggleActive}
              disabled={toggling}
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              {tenant.is_active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          <Badge variant={tenant.is_active ? 'default' : 'secondary'} className="text-sm px-3 py-1">
            {tenant.is_active ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Ativo
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Inativo
              </>
            )}
          </Badge>
        </div>

        {/* Informações Gerais */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Dados principais do tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nome</p>
                <p className="text-lg font-semibold">{tenant.name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Slug</p>
                <p className="text-lg font-mono">{tenant.slug}</p>
              </div>
              {tenant.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                    <p className="text-base">{tenant.description}</p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Onboarding</p>
                <div className="flex items-center gap-2 mt-1">
                  {tenant.onboarding_completed ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Completo</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Pendente</span>
                    </>
                  )}
                </div>
                {tenant.onboarding_completed_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Concluído em {format(new Date(tenant.onboarding_completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limites e Capacidade</CardTitle>
              <CardDescription>Configurações de limites do tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Máximo de Usuários</p>
                  </div>
                  <p className="text-lg font-semibold">{tenant.max_users}</p>
                </div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Máximo de Clientes</p>
                  </div>
                  <p className="text-lg font-semibold">{tenant.max_clients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Identidade visual do tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Nome da Empresa</p>
                <p className="text-base">{tenant.branding?.companyName || tenant.name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Cor Primária</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: tenant.branding?.primaryColor || '#3b82f6' }}
                  />
                  <p className="text-sm font-mono">{tenant.branding?.primaryColor || '#3b82f6'}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Cor Secundária</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: tenant.branding?.secondaryColor || '#8b5cf6' }}
                  />
                  <p className="text-sm font-mono">{tenant.branding?.secondaryColor || '#8b5cf6'}</p>
                </div>
              </div>
              {tenant.branding?.logo && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Logo</p>
                    <img
                      src={tenant.branding.logo}
                      alt="Logo"
                      className="h-16 w-auto object-contain"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datas</CardTitle>
              <CardDescription>Informações temporais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Criado em</p>
                </div>
                <p className="text-base">
                  {format(new Date(tenant.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Última atualização</p>
                </div>
                <p className="text-base">
                  {format(new Date(tenant.updated_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}

export default function TenantDetailPage() {
  return (
    <ProtectedRoute>
      <TenantDetailPageContent />
    </ProtectedRoute>
  )
}





