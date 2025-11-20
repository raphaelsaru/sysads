'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Moon, Sun, Building2, Users, Palette } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
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

export default function Header() {
  const { userProfile, signOut } = useAuth()
  const { branding } = useTenant()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const hasDark = root.classList.contains('dark') || root.getAttribute('data-pc-theme') === 'dark'
    setIsDarkMode(hasDark)
  }, [])

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

  const companyName = branding?.companyName || userProfile?.full_name || 'Prizely'
  const companyInitial = companyName.charAt(0)?.toUpperCase() ?? 'P'
  
  // Navegação baseada em role
  const navItems = [
    { href: '/', label: 'Clientes CRM' },
    { href: '/dashboard', label: 'Dashboard' },
    ...(userProfile?.role === 'admin_global' ? [
      { href: '/admin', label: 'Admin' },
      { href: '/admin/tenants', label: 'Tenants' }
    ] : []),
    ...(userProfile?.role === 'tenant_admin' ? [
      { href: '/settings/users', label: 'Usuários', icon: Users },
      { href: '/settings/branding', label: 'Branding', icon: Palette }
    ] : []),
  ]
  
  // Role badge
  const getRoleBadge = () => {
    switch (userProfile?.role) {
      case 'admin_global':
        return <Badge variant="destructive" className="text-xs">Super Admin</Badge>
      case 'tenant_admin':
        return <Badge variant="default" className="text-xs">Admin</Badge>
      case 'tenant_user':
        return <Badge variant="secondary" className="text-xs">Usuário</Badge>
      default:
        return null
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between gap-4 py-6">
          {/* Logo - lado esquerdo */}
          <div className="flex items-center">
            {branding?.logo ? (
              <div className="relative h-auto w-[125px]">
                <Image
                  src={branding.logo}
                  alt={`Logo ${companyName}`}
                  width={125}
                  height={125}
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="relative h-auto w-[125px]">
                 <Image
                  src="/logo-prizely.png"
                  alt="Prizely Logo"
                  width={125}
                  height={125}
                  className="object-contain"
                />
              </div>
            )}
          </div>

          {/* Navegação - centro (desktop) */}
          <nav className="hidden md:flex md:flex-1 md:justify-center">
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-1 py-1 text-sm font-medium shadow-soft backdrop-blur">
              {navItems.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'rounded-full px-3 py-2 transition-colors hover:text-primary',
                    pathname === href ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Botões de ação - lado direito */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsBell />
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
              className="border-border/70 bg-background/60 backdrop-blur"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Perfil do usuário - melhorado */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium',
                    // Em mobile, mostrar apenas a bolinha
                    'md:px-4 md:py-2.5',
                    // Em mobile, reduzir gap e padding
                    'sm:gap-2 sm:px-2 sm:py-1.5'
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-brand">
                    {companyInitial}
                  </span>
                  {/* Texto do perfil - apenas em desktop */}
                  <span className="hidden text-left lg:flex lg:flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {userProfile?.full_name || 'Usuário'}
                      </span>
                      {getRoleBadge()}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {userProfile?.tenant?.name || companyName}
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
                    {userProfile?.tenant && (
                      <div className="flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {userProfile.tenant.name}
                        </span>
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    void signOut()
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Navegação mobile - abaixo do header principal */}
        <nav className="md:hidden">
          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-1 py-1 text-sm font-medium shadow-soft backdrop-blur">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
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