'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UsersRound } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const MENU_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral e estatísticas',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    id: 'clientes',
    label: 'Clientes',
    description: 'Gestão completa dos relacionamentos',
    href: '/clientes',
    icon: UsersRound,
  },
] as const

interface SidebarProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export default function Sidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const pathname = usePathname()

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-gradient-to-b from-primary/15 via-card to-background px-4 py-6">
      <div className="space-y-6">
        <Link href="/" className="block">
          <div
            className={cn(
              'flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary-foreground shadow-brand backdrop-blur',
              collapsed && 'justify-center'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
              PZ
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-primary-foreground/90">
                  Prizely CRM
                </span>
                <span className="text-xs font-medium text-primary-foreground/70">
                  Experiências memoráveis
                </span>
              </div>
            )}
          </div>
        </Link>

        <nav className="space-y-2">
          {MENU_ITEMS.map(({ id, label, description, href, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Button
                key={id}
                asChild
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'group w-full justify-start gap-3 rounded-xl py-4 text-sm font-semibold transition',
                  collapsed && 'justify-center px-0 text-xs'
                )}
              >
                <Link href={href}>
                  <span className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'h-5 w-5 transition group-hover:scale-110',
                        isActive ? 'text-primary-foreground' : 'text-primary'
                      )}
                    />
                    {!collapsed && (
                      <span className="flex flex-col">
                        <span className="text-sm text-foreground">{label}</span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {description}
                        </span>
                      </span>
                    )}
                  </span>
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>

      <div className={cn('rounded-xl border border-border/60 bg-background/80 p-3 text-xs text-muted-foreground', collapsed && 'hidden')}>
        <p className="font-semibold text-foreground">Dica rápida</p>
        <p className="mt-1 leading-relaxed">
          Recolha a barra lateral para ganhar ainda mais espaço visual no painel.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-center"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? 'Expandir navegação' : 'Recolher navegação'}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[85vw] max-w-xs border-none p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação principal</SheetTitle>
          </SheetHeader>
          {navContent}
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          'pointer-events-auto fixed inset-y-0 left-0 z-40 hidden h-full border-r border-border/70 bg-background shadow-soft lg:flex lg:flex-col',
          collapsed ? 'w-[96px]' : 'w-[272px]'
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
