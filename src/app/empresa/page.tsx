'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, Palette, Loader2, Mail } from 'lucide-react'

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
import { Switch } from '@/components/ui/switch'
import MetaAdsCard from '@/components/empresa/MetaAdsCard'
import { HEX_COLOR_RE, foregroundFor, hexToHslTriplet } from '@/lib/color'
import { canManageTeam, isSuperadmin, roleLabel } from '@/lib/roles'
import type { UserRole } from '@/types/crm'

// Aproximação em hex do --primary padrão (globals.css: 32 46% 45%)
const COR_PADRAO = '#A8763E'

type UsuarioEmpresa = {
  id: string
  role: UserRole
  full_name: string | null
  is_active: boolean
  created_at: string
  email: string | null
  convite_pendente: boolean
}

type Slots = { usados: number; total: number | null }

async function erroDa(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}))
  return new Error(data.error || fallback)
}

function EmpresaPageContent() {
  const router = useRouter()
  const { userProfile, tenant, refreshProfile } = useAuth()
  const podeGerenciar = canManageTeam(userProfile?.role)

  const [cor, setCor] = useState(COR_PADRAO)
  const [salvandoCor, setSalvandoCor] = useState(false)

  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
  const [slots, setSlots] = useState<Slots>({ usados: 0, total: null })
  const [loading, setLoading] = useState(true)
  const [recarregando, setRecarregando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [salvandoAtivo, setSalvandoAtivo] = useState<Set<string>>(new Set())
  const [reenviando, setReenviando] = useState<string | null>(null)

  const [conviteOpen, setConviteOpen] = useState(false)
  const [convidando, setConvidando] = useState(false)
  const [convite, setConvite] = useState({ full_name: '', email: '' })

  useEffect(() => {
    if (userProfile && !canManageTeam(userProfile.role)) {
      router.push('/dashboard')
    }
  }, [userProfile, router])

  useEffect(() => {
    setCor(tenant?.branding?.primaryColor || COR_PADRAO)
  }, [tenant?.branding?.primaryColor])

  // Incrementado a cada carga (e na troca de empresa): respostas antigas são ignoradas.
  const cargaAtual = useRef(0)
  const tenantId = tenant?.id ?? null

  const carregarUsuarios = useCallback(async (silencioso = false) => {
    const carga = ++cargaAtual.current
    const setCarregando = silencioso ? setRecarregando : setLoading
    try {
      setCarregando(true)
      if (!silencioso) {
        setRecarregando(false)
        setError(null)
      }
      const response = await fetch('/api/empresa/usuarios')
      if (!response.ok) throw await erroDa(response, 'Erro ao carregar usuários')
      const data = await response.json()
      if (carga !== cargaAtual.current) return
      setUsuarios(data.usuarios || [])
      setSlots(data.slots || { usados: 0, total: null })
      setError(null)
    } catch (err) {
      if (carga !== cargaAtual.current) return
      if (silencioso) alert(err instanceof Error ? err.message : 'Erro ao recarregar usuários')
      else setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      if (carga === cargaAtual.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!podeGerenciar) return
    if (!tenantId) {
      cargaAtual.current++
      setUsuarios([])
      setSlots({ usados: 0, total: null })
      setLoading(false)
      setError('Nenhuma empresa selecionada.')
      return
    }
    carregarUsuarios()
    return () => {
      // Contador (não nó do DOM): invalidar respostas pendentes é exatamente o objetivo.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cargaAtual.current++
      setRecarregando(false)
    }
  }, [podeGerenciar, tenantId, carregarUsuarios])

  const salvarCor = async (primaryColor: string | null) => {
    if (primaryColor !== null && !HEX_COLOR_RE.test(primaryColor)) {
      alert('Cor inválida. Use o formato #RRGGBB.')
      return
    }
    try {
      setSalvandoCor(true)
      const response = await fetch('/api/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor }),
      })
      if (!response.ok) throw await erroDa(response, 'Erro ao salvar cor')
      await refreshProfile()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar cor')
    } finally {
      setSalvandoCor(false)
    }
  }

  const fecharConvite = (open: boolean) => {
    if (open || convidando) return
    setConviteOpen(false)
    setConvite({ full_name: '', email: '' })
  }

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = convite.email.trim()
    const full_name = convite.full_name.trim()
    if (!email || !full_name) {
      alert('Nome e email são obrigatórios')
      return
    }
    try {
      setConvidando(true)
      const response = await fetch('/api/empresa/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name }),
      })
      if (!response.ok) throw await erroDa(response, 'Erro ao convidar usuário')
      const data = await response.json()
      setConviteOpen(false)
      setConvite({ full_name: '', email: '' })
      await carregarUsuarios(true)
      alert(data.reaproveitado
        ? 'Usuário existente vinculado — ele entra com a senha atual.'
        : `Convite enviado para ${email}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao convidar usuário')
    } finally {
      setConvidando(false)
    }
  }

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    const delta = ativo ? 1 : -1
    // Se a lista for recarregada no meio, os slots já vêm do servidor: não reverter.
    const carga = cargaAtual.current
    const aplicar = (valor: boolean, d: number) => {
      setUsuarios(prev => prev.map(u => (u.id === id ? { ...u, is_active: valor } : u)))
      if (carga === cargaAtual.current) setSlots(prev => ({ ...prev, usados: prev.usados + d }))
    }
    setSalvandoAtivo(prev => new Set(prev).add(id))
    aplicar(ativo, delta)

    try {
      const response = await fetch(`/api/empresa/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: ativo }),
      })
      if (!response.ok) throw await erroDa(response, 'Erro ao atualizar usuário')
    } catch (err) {
      aplicar(!ativo, -delta)
      alert(err instanceof Error ? err.message : 'Erro ao atualizar usuário')
    } finally {
      setSalvandoAtivo(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleReenviar = async (usuario: UsuarioEmpresa) => {
    try {
      setReenviando(usuario.id)
      const response = await fetch(`/api/empresa/usuarios/${usuario.id}/reenviar`, { method: 'POST' })
      if (!response.ok) throw await erroDa(response, 'Erro ao reenviar convite')
      const { tipo } = await response.json().catch(() => ({})) as { tipo?: string }
      const destino = usuario.email ?? usuario.full_name ?? 'o usuário'
      alert(tipo === 'recuperacao'
        ? `Link de redefinição de senha enviado para ${destino}`
        : `Convite reenviado para ${destino}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao reenviar convite')
    } finally {
      setReenviando(null)
    }
  }

  const switchDesabilitado = (u: UsuarioEmpresa) =>
    salvandoAtivo.has(u.id) ||
    u.id === userProfile?.id ||
    u.role === 'admin' ||
    (u.role === 'owner' && !isSuperadmin(userProfile?.role))

  const getStatusBadge = (u: UsuarioEmpresa) => {
    if (u.convite_pendente && u.is_active) return <Badge variant="outline">Convite pendente</Badge>
    return u.is_active
      ? <Badge variant="default">Ativo</Badge>
      : <Badge variant="secondary">Inativo</Badge>
  }

  const slotsCheios = slots.total !== null && slots.usados >= slots.total
  const corValida = HEX_COLOR_RE.test(cor)
  const corSalva = tenant?.branding?.primaryColor || COR_PADRAO
  const corInalterada = cor.toUpperCase() === corSalva.toUpperCase()

  if (!userProfile) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    )
  }

  if (!podeGerenciar) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <h1 className="mb-2 text-xl font-semibold">Acesso Negado</h1>
              <p className="text-sm text-muted-foreground">
                Apenas donos da empresa podem acessar esta área.
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
        <div>
          <h1 className="text-3xl font-bold">{tenant?.name ?? 'Empresa'}</h1>
          <p className="text-muted-foreground mt-1">Minha empresa</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Aparência
            </CardTitle>
            <CardDescription>Cor principal usada nos botões e destaques do CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="cor-picker">Cor</Label>
                <input
                  id="cor-picker"
                  type="color"
                  value={corValida ? cor : COR_PADRAO}
                  onChange={(e) => setCor(e.target.value.toUpperCase())}
                  className="mt-1 block h-10 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                />
              </div>
              <div>
                <Label htmlFor="cor-hex">Hex</Label>
                <Input
                  id="cor-hex"
                  value={cor}
                  onChange={(e) => setCor(e.target.value.trim())}
                  placeholder="#RRGGBB"
                  maxLength={7}
                  className="mt-1 w-32 font-mono"
                  aria-invalid={!corValida}
                  aria-describedby={corValida ? undefined : 'cor-hex-erro'}
                />
              </div>
              <div>
                <span className="text-sm font-medium leading-none">Prévia</span>
                <Button
                  type="button"
                  aria-hidden
                  className="mt-1 block pointer-events-none"
                  style={corValida
                    ? { backgroundColor: cor, borderColor: cor, color: `hsl(${foregroundFor(hexToHslTriplet(cor))})` }
                    : undefined}
                  tabIndex={-1}
                >
                  Botão de exemplo
                </Button>
              </div>
            </div>
            {!corValida && (
              <p id="cor-hex-erro" className="text-sm text-destructive">Use o formato #RRGGBB.</p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => salvarCor(cor)} disabled={salvandoCor || !corValida || corInalterada}>
                {salvandoCor && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              <Button
                variant="outline"
                onClick={() => salvarCor(null)}
                disabled={salvandoCor || !tenant?.branding?.primaryColor}
              >
                Restaurar padrão
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuários
                {recarregando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Badge variant="secondary">
                  {slots.total === null ? `${slots.usados}/ilimitado` : `${slots.usados}/${slots.total}`} slots
                </Badge>
              </CardTitle>
              <CardDescription>Pessoas com acesso ao CRM da sua empresa</CardDescription>
            </div>
            <Button onClick={() => setConviteOpen(true)} disabled={loading || slotsCheios}>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar usuário
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

            {!loading && !error && usuarios.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  Convide pessoas da sua equipe para começar
                </p>
              </div>
            )}

            {!loading && !error && usuarios.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || 'Sem nome'}</TableCell>
                      <TableCell>{u.email || '-'}</TableCell>
                      <TableCell>{roleLabel[u.role] ?? u.role}</TableCell>
                      <TableCell>{getStatusBadge(u)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={u.is_active}
                          disabled={switchDesabilitado(u)}
                          onCheckedChange={(checked) => handleToggleAtivo(u.id, checked)}
                          aria-label={`Ativar ${u.full_name || 'usuário'}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {u.convite_pendente && u.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReenviar(u)}
                            disabled={reenviando === u.id}
                          >
                            {reenviando === u.id
                              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              : <Mail className="h-4 w-4 mr-2" />}
                            Reenviar convite
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {isSuperadmin(userProfile?.role) && <MetaAdsCard tenantId={tenantId} />}
      </div>

      <Dialog open={conviteOpen} onOpenChange={fecharConvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>
              Enviaremos um email para a pessoa definir a senha e acessar o CRM.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConvidar} className="space-y-4">
            <div>
              <Label htmlFor="convite-nome">Nome *</Label>
              <Input id="convite-nome" value={convite.full_name}
                onChange={(e) => setConvite({ ...convite, full_name: e.target.value })}
                placeholder="João Silva" />
            </div>
            <div>
              <Label htmlFor="convite-email">Email *</Label>
              <Input id="convite-email" type="email" value={convite.email}
                onChange={(e) => setConvite({ ...convite, email: e.target.value })}
                placeholder="usuario@exemplo.com" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => fecharConvite(false)} disabled={convidando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={convidando}>
                {convidando
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                  : <><UserPlus className="h-4 w-4 mr-2" />Convidar</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

export default function EmpresaPage() {
  return (
    <ProtectedRoute>
      <EmpresaPageContent />
    </ProtectedRoute>
  )
}
