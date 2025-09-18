'use client'

import { useEffect, useState } from 'react'
import { Menu, Moon, PanelLeftOpen, PanelRightOpen, Sun } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onToggleMobileSidebar: () => void
  onToggleCollapsed: () => void
  collapsed: boolean
}

export default function Header({ onToggleMobileSidebar, onToggleCollapsed, collapsed }: HeaderProps) {
  const { userProfile, signOut } = useAuth()
  const [isDarkMode, setIsDarkMode] = useState(false)

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

  const companyInitial = userProfile?.company_name?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="inline-flex lg:hidden"
            onClick={onToggleMobileSidebar}
            aria-label="Abrir navegação"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden lg:block">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            >
              {collapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {userProfile?.company_name || 'CRM Prizely'}
            </span>
            <h1 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
              Painel de relacionamento
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className="border-border/70 bg-background/60 backdrop-blur"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-2 pr-3 text-sm font-medium shadow-soft backdrop-blur transition hover:bg-card'
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-brand">
                  {companyInitial}
                </span>
                <span className="hidden text-left lg:flex lg:flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {userProfile?.company_name || 'Usuário'}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {userProfile?.role === 'admin' ? 'Administrador' : 'Colaborador'}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {userProfile?.company_name || 'Conta'}
                  </span>
                  <span className="text-xs text-muted-foreground break-all">
                    {userProfile?.email}
                  </span>
                  <span className="text-xs font-medium text-info">
                    Moeda padrão: {userProfile?.currency || 'BRL'}
                  </span>
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
    </header>
  )
}
