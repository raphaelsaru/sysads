'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Eye,
  UserPlus,
  Edit3,
  Shield,
  ShieldCheck,
  Building2,
  Mail,
  Calendar,
  TrendingUp,
  Users,
  Loader2
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAdmin } from '@/contexts/AdminContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ExtendedUserProfile {
  id: string
  company_name: string
  email: string
  currency: 'BRL' | 'USD' | 'EUR'
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
  totalClientes: number
  totalVendas: number
  valorTotal: number
  ultimoLogin?: string
  ativo: boolean
}

interface UserManagementProps {
  users: ExtendedUserProfile[]
  onUserUpdate: () => void
  selectedUserId: string | null
  onUserSelect: (userId: string) => void
}

export default function UserManagement({ users, onUserUpdate, selectedUserId, onUserSelect }: UserManagementProps) {
  const { startImpersonation, canImpersonate } = useAdmin()
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showEditUser, setShowEditUser] = useState<ExtendedUserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    company_name: '',
    role: 'user' as 'admin' | 'user',
    currency: 'BRL' as 'BRL' | 'USD' | 'EUR',
  })

  const [editUser, setEditUser] = useState({
    company_name: '',
    role: 'user' as 'admin' | 'user',
    currency: 'BRL' as 'BRL' | 'USD' | 'EUR',
    ativo: true,
  })

  useEffect(() => {
    if (showEditUser) {
      setEditUser({
        company_name: showEditUser.company_name,
        role: showEditUser.role,
        currency: showEditUser.currency,
        ativo: showEditUser.ativo,
      })
    }
  }, [showEditUser])

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.company_name) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)
    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            company_name: newUser.company_name,
            role: newUser.role,
            currency: newUser.currency,
          }
        }
      })

      if (authError) throw authError

      // Criar perfil na tabela users
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: newUser.email,
            company_name: newUser.company_name,
            role: newUser.role,
            currency: newUser.currency,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

        if (profileError) throw profileError
      }

      setNewUser({
        email: '',
        password: '',
        company_name: '',
        role: 'user',
        currency: 'BRL',
      })
      setShowCreateUser(false)
      onUserUpdate()
      alert('Usuário criado com sucesso!')
    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      alert('Erro ao criar usuário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!showEditUser) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          company_name: editUser.company_name,
          role: editUser.role,
          currency: editUser.currency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', showEditUser.id)

      if (error) throw error

      setShowEditUser(null)
      onUserUpdate()
      alert('Usuário atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error)
      alert('Erro ao atualizar usuário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleImpersonateUser = (user: ExtendedUserProfile) => {
    if (!canImpersonate) {
      alert('Você não tem permissão para impersonar usuários')
      return
    }

    startImpersonation(user)
  }

  const totalUsers = users.length
  const activeUsers = users.filter(u => u.ativo).length
  const adminUsers = users.filter(u => u.role === 'admin').length
  const totalLeads = users.reduce((acc, u) => acc + u.totalClientes, 0)

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/70 bg-card/80">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total de usuários</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <UserPlus className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeUsers}</p>
              <p className="text-xs text-muted-foreground">Usuários ativos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <ShieldCheck className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{adminUsers}</p>
              <p className="text-xs text-muted-foreground">Administradores</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-info/10">
              <TrendingUp className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
              <p className="text-xs text-muted-foreground">Total de leads</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações e Lista de Usuários */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Gerenciamento de Usuários
            </CardTitle>
            <CardDescription>
              Gerencie contas de usuários, permissões e visualize dados como admin
            </CardDescription>
          </div>

          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Criar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar uma nova conta de usuário
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="usuario@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Senha segura"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa *</Label>
                  <Input
                    id="company_name"
                    value={newUser.company_name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nível de Acesso</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: 'admin' | 'user') => setNewUser(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select
                      value={newUser.currency}
                      onValueChange={(value: 'BRL' | 'USD' | 'EUR') => setNewUser(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">BRL (R$)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setShowCreateUser(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateUser}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-3">
          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const isSelected = user.id === selectedUserId
                return (
                  <Card
                    key={user.id}
                    className={cn(
                      'border border-border/70 bg-background/70 transition-all hover:shadow-md',
                      isSelected && 'border-primary/70 bg-primary/5 shadow-primary/20'
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">
                                  {user.company_name || 'Sem nome'}
                                </h3>
                                <div className="flex gap-1">
                                  {user.role === 'admin' && (
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                      <Shield className="h-3 w-3" />
                                      Admin
                                    </Badge>
                                  )}
                                  <Badge variant={user.ativo ? 'success' : 'destructive'} className="text-xs">
                                    {user.ativo ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {user.currency}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>

                          <Separator className="opacity-60" />

                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="font-medium text-foreground">{user.totalClientes}</p>
                              <p className="text-muted-foreground">Leads</p>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{user.totalVendas}</p>
                              <p className="text-muted-foreground">Vendas</p>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(user.created_at), 'dd/MM/yyyy')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => onUserSelect(user.id)}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className="gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            {isSelected ? 'Selecionado' : 'Ver dados'}
                          </Button>

                          {canImpersonate && user.role !== 'admin' && (
                            <Button
                              onClick={() => handleImpersonateUser(user)}
                              variant="secondary"
                              size="sm"
                              className="gap-1"
                            >
                              <UserPlus className="h-3 w-3" />
                              Visualizar como
                            </Button>
                          )}

                          <Dialog open={showEditUser?.id === user.id} onOpenChange={(open) => !open && setShowEditUser(null)}>
                            <DialogTrigger asChild>
                              <Button
                                onClick={() => setShowEditUser(user)}
                                variant="outline"
                                size="sm"
                                className="gap-1"
                              >
                                <Edit3 className="h-3 w-3" />
                                Editar
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Editar Usuário</DialogTitle>
                                <DialogDescription>
                                  Modificar informações de {user.company_name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit_company_name">Nome da Empresa</Label>
                                  <Input
                                    id="edit_company_name"
                                    value={editUser.company_name}
                                    onChange={(e) => setEditUser(prev => ({ ...prev, company_name: e.target.value }))}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Nível de Acesso</Label>
                                    <Select
                                      value={editUser.role}
                                      onValueChange={(value: 'admin' | 'user') => setEditUser(prev => ({ ...prev, role: value }))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="user">Usuário</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Moeda</Label>
                                    <Select
                                      value={editUser.currency}
                                      onValueChange={(value: 'BRL' | 'USD' | 'EUR') => setEditUser(prev => ({ ...prev, currency: value }))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="BRL">BRL (R$)</SelectItem>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                  <Button
                                    onClick={() => setShowEditUser(null)}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    onClick={handleUpdateUser}
                                    disabled={loading}
                                    className="flex-1"
                                  >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}