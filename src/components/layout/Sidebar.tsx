'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Moon, Sun, Eye, X, Menu } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Symbol } from '@/components/ui/symbol'
import { canManageTeam, isSuperadmin, roleLabel } from '@/lib/roles'
import { FALLBACK_CURRENCY_VALUE } from '@/lib/currency'
import NotificationsBell from '@/components/NotificationsBell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface UserOption {
  id: string
  email: string
  company_name: string
  currency: string
}

interface UsuarioEmpresa {
  id: string
  full_name: string | null
  email: string | null
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { userProfile } = useAuth()
  const superadmin = isSuperadmin(userProfile?.role)

  const navItems: { href: string; label: string }[] = [
    { href: '/', label: 'Leads' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/dashboard', label: 'Painel' },
    { href: '/calendario', label: 'Agenda' },
    { href: '/settings/integrations', label: 'Integrações' },
    ...(canManageTeam(userProfile?.role) ? [{ href: '/empresa', label: 'Minha empresa' }] : []),
    ...(superadmin ? [
      { href: '/admin/empresas', label: 'Empresas' },
      { href: '/admin', label: 'Administração' },
      { href: '/settings/users', label: 'Usuários (global)' },
      { href: '/admin/google-calendar', label: 'Google Calendar' },
    ] : []),
  ]

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, label }) => (
        <Link
          key={href}
          href={href as never}
          onClick={onNavigate}
          className={cn(
            'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === href
              ? 'bg-foreground text-background'
              : 'text-foreground/80 hover:bg-muted hover:text-foreground'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

function AccountFooter() {
  const { userProfile, tenant, signOut } = useAuth()
  const { impersonatedUser } = useAdmin()

  const companyName = impersonatedUser?.company_name || tenant?.name || userProfile?.company_name || userProfile?.full_name || 'Prizely'

  const getRoleBadge = () => {
    const role = userProfile?.role
    if (!role) return null
    return (
      <Badge variant={role === 'user' ? 'secondary' : 'default'} className="text-xs">
        {roleLabel[role]}
      </Badge>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full flex-col items-start gap-0.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {userProfile?.full_name || 'Usuário'}
            </span>
            {getRoleBadge()}
          </div>
          <span className="text-xs text-muted-foreground">{companyName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {userProfile?.full_name || 'Conta'}
              </span>
              {getRoleBadge()}
            </div>
            <span className="break-all text-xs text-muted-foreground">
              {userProfile?.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => { void signOut() }}
          className="text-destructive focus:text-destructive"
        >
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { userProfile, tenant } = useAuth()
  const { impersonatedUser, startImpersonation, stopImpersonation } = useAdmin()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])

  const podeVisualizarComo = canManageTeam(userProfile?.role)
  const tenantId = tenant?.id ?? null
  const moedaPadrao = userProfile?.currency ?? FALLBACK_CURRENCY_VALUE

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const hasDark = root.classList.contains('dark') || root.getAttribute('data-pc-theme') === 'dark'
    setIsDarkMode(hasDark)
  }, [])

  // Trocou de empresa: encerra "visualizar como" (usuário pertence à empresa anterior).
  const tenantAnteriorRef = useRef(tenantId)
  useEffect(() => {
    if (tenantAnteriorRef.current !== tenantId) {
      if (tenantAnteriorRef.current !== null) stopImpersonation()
      tenantAnteriorRef.current = tenantId
    }
  }, [tenantId, stopImpersonation])

  useEffect(() => {
    if (!podeVisualizarComo || !tenantId) return
    let cancelado = false
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/empresa/usuarios?ativos=1')
        if (!res.ok || cancelado) return
        const data = await res.json()
        if (cancelado) return
        const lista = ((data.usuarios || []) as UsuarioEmpresa[])
          .filter((u) => u.id !== userProfile?.id)
          .map((u) => ({
            id: u.id,
            email: u.email ?? '',
            company_name: u.full_name ?? u.email ?? 'Sem nome',
            currency: moedaPadrao,
          }))
        setUsers(lista)
      } catch {}
    }
    fetchUsers()
    return () => { cancelado = true }
  }, [podeVisualizarComo, tenantId, userProfile?.id, moedaPadrao])

  const toggleTheme = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    const root = document.documentElement
    if (next) {
      root.classList.add('dark')
      root.setAttribute('data-pc-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.removeAttribute('data-pc-theme')
    }
  }

  return (
    <div className="flex h-full flex-col gap-8 px-6 py-8">
      <div className="flex items-center gap-2">
        <Symbol className="h-7 w-7 shrink-0" />
        <span className="font-display text-2xl font-medium text-foreground">Prizely</span>
      </div>

      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {podeVisualizarComo && users.length > 0 && !impersonatedUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Visualizar como outro usuário">
                  <Eye className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Visualizar como</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {users.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => startImpersonation(user)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user.company_name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <NotificationsBell />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <AccountFooter />
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { impersonatedUser, stopImpersonation } = useAdmin()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {impersonatedUser && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-warning/30 bg-warning/95 px-4 py-2 text-sm text-warning-foreground shadow-lg backdrop-blur">
            <Eye className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              Visualizando como <strong>{impersonatedUser.company_name}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopImpersonation}
              className="h-6 gap-1 rounded-full px-2 text-xs text-warning-foreground hover:bg-warning-foreground/10 hover:text-warning-foreground"
            >
              <X className="h-3 w-3" />
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Sidebar fixa — desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 border-r border-border md:block">
        <SidebarBody />
      </aside>

      {/* Barra superior + drawer — mobile */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Symbol className="h-6 w-6 shrink-0" />
          <span className="font-display text-xl font-medium text-foreground">Prizely</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
