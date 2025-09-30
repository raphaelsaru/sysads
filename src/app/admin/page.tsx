'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Eye, Shield, Mail, Building2, Calendar, Loader2, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface User {
  id: string
  email: string
  company_name: string
  currency: string
  role: string
  created_at: string
}

function AdminPageContent() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const { impersonatedUser, startImpersonation, stopImpersonation } = useAdmin()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Verificar se é admin
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [userProfile, router])

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

    if (userProfile?.role === 'admin') {
      fetchUsers()
    }
  }, [userProfile])

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

  if (userProfile?.role !== 'admin') {
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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Painel de Administração</h1>
          </div>
          <p className="text-muted-foreground">
            Gerencie usuários e visualize o sistema como qualquer usuário
          </p>
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
                                {user.role === 'admin' && (
                                  <Badge variant="secondary" className="gap-1 text-xs">
                                    <Shield className="h-3 w-3" />
                                    Admin
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
                          {user.role !== 'admin' && (
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
      </div>
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
