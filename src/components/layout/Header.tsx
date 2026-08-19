'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Moon, Sun, Eye, X } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import NotificationsBell from '@/components/NotificationsBell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface UserOption {
  id: string
  email: string
  company_name: string
  currency: string
  role: string
}

export default function Header() {
  const { userProfile, signOut } = useAuth()
  const { impersonatedUser, startImpersonation, stopImpersonation } = useAdmin()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const pathname = usePathname()

  const isAdmin = userProfile?.role === 'admin'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const hasDark = root.classList.contains('dark') || root.getAttribute('data-pc-theme') === 'dark'
    setIsDarkMode(hasDark)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/users')
        if (res.ok) {
          const data = await res.json()
          setUsers((data.users || []).filter((u: UserOption) => u.id !== userProfile?.id))
        }
      } catch {}
    }
    fetchUsers()
  }, [isAdmin, userProfile?.id])

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

  const companyName = impersonatedUser?.company_name || userProfile?.company_name || userProfile?.full_name || 'Prizely'
  const companyInitial = companyName.charAt(0)?.toUpperCase() ?? 'P'

  const navItems: { href: string; label: string }[] = [
    { href: '/', label: 'Leads' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/settings/integrations', label: 'Integrações' },
    ...(isAdmin ? [
      { href: '/admin', label: 'Admin' },
      { href: '/settings/users', label: 'Usuários' },
    ] : []),
  ]

  const getRoleBadge = () => {
    switch (userProfile?.role) {
      case 'admin':
        return <Badge variant="default" className="text-xs">Admin</Badge>
      case 'user':
        return <Badge variant="secondary" className="text-xs">Usuário</Badge>
      default:
        return null
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-background/50 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10">
      {impersonatedUser && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <Eye className="h-4 w-4" />
              Visualizando como <strong>{impersonatedUser.company_name}</strong>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopImpersonation}
              className="h-7 gap-1 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-400"
            >
              <X className="h-3 w-3" />
              Voltar
            </Button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between gap-4 py-6">
          <div className="flex items-center">
            <div className="relative h-auto w-[125px]">
              <Image
                src="/logo-prizely.png"
                alt="Prizely Logo"
                width={125}
                height={125}
                className="object-contain"
              />
            </div>
          </div>

          <nav className="hidden md:flex md:flex-1 md:justify-center">
            <div className="glass flex items-center gap-1 rounded-full px-1 py-1 text-sm font-medium">
              {navItems.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href as never}
                  className={cn(
                    'rounded-full px-3 py-2 transition-colors hover:text-primary',
                    pathname === href
                      ? 'bg-primary/15 text-primary shadow-[inset_0_1px_0_0_hsl(var(--glass-highlight)/0.4)]'
                      : 'text-muted-foreground'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && users.length > 0 && !impersonatedUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Visualizar como outro usuário"
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
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
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium',
                    'md:px-4 md:py-2.5',
                    'sm:gap-2 sm:px-2 sm:py-1.5'
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-brand">
                    {companyInitial}
                  </span>
                  <span className="hidden text-left lg:flex lg:flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {userProfile?.full_name || 'Usuário'}
                      </span>
                      {getRoleBadge()}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {companyName}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
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
          </div>
        </div>

        <nav className="md:hidden">
          <div className="glass flex items-center gap-1 rounded-full px-1 py-1 text-sm font-medium">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href as never}
                className={cn(
                  'flex-1 rounded-full px-3 py-2 text-center transition-colors hover:text-primary',
                  pathname === href ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}
