'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { UserProfile, UserRole } from '@/types/crm'
import { isSuperadmin, roleLabel } from '@/lib/roles'

type UsuarioListado = UserProfile & { assistant_enabled?: boolean }

function UsersPageContent() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const [users, setUsers] = useState<UsuarioListado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assistantSaving, setAssistantSaving] = useState<string | null>(null)

  useEffect(() => {
    if (userProfile && !isSuperadmin(userProfile.role)) {
      router.push('/dashboard')
    }
  }, [userProfile, router])

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
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    if (isSuperadmin(userProfile?.role)) {
      fetchUsers()
    }
  }, [userProfile])

  const handleToggleAssistant = async (userId: string, enabled: boolean) => {
    const anterior = users
    setAssistantSaving(userId)
    setUsers(users.map(u => (u.id === userId ? { ...u, assistant_enabled: enabled } : u)))

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant_enabled: enabled }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao atualizar acesso ao assistente')
      }
    } catch (err) {
      setUsers(anterior)
      alert(err instanceof Error ? err.message : 'Erro ao atualizar acesso ao assistente')
    } finally {
      setAssistantSaving(null)
    }
  }

  const getRoleBadge = (role: UserRole) => {
    const variant = role === 'admin' ? 'default' : role === 'owner' ? 'outline' : 'secondary'
    return <Badge variant={variant}>{roleLabel[role] ?? role}</Badge>
  }

  const isAdmin = isSuperadmin(userProfile?.role)

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
 <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <h1 className="mb-2 text-xl font-semibold">Acesso Negado</h1>
              <p className="text-sm text-muted-foreground">
                Apenas admins podem acessar esta área.
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
            <p className="text-muted-foreground mt-1">
              Todos os usuários do sistema. Novas contas entram por convite da empresa.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários ({users.length})
            </CardTitle>
            <CardDescription>Lista de todos os usuários cadastrados</CardDescription>
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

            {!loading && !error && users.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  Quando houver usuários, eles aparecerão aqui
                </p>
              </div>
            )}

            {!loading && !error && users.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Telefone</TableHead>
                    {isAdmin && <TableHead>Assistente</TableHead>}
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Switch
                            checked={user.assistant_enabled === true}
                            disabled={assistantSaving === user.id}
                            onCheckedChange={(checked) => handleToggleAssistant(user.id, checked)}
                            aria-label={`Acesso ao assistente de ${user.full_name || 'usuário'}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

    </MainLayout>
  )
}

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <UsersPageContent />
    </ProtectedRoute>
  )
}
