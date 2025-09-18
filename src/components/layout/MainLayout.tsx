'use client'

import { ReactNode, useState } from 'react'

import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="relative min-h-screen bg-background">
      <Sidebar
        collapsed={isCollapsed}
        onCollapsedChange={setIsCollapsed}
        mobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
      />

      <div
        className={cn(
          'min-h-screen transition-[padding] duration-300 lg:pl-[280px]',
          isCollapsed && 'lg:pl-[108px]'
        )}
      >
        <Header
          collapsed={isCollapsed}
          onToggleCollapsed={() => setIsCollapsed((prev) => !prev)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="px-4 pb-12 pt-24 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
