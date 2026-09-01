'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col md:flex-row">
      <Sidebar />

      <main className="flex-1 pb-12 pt-8 md:pt-12">
        <div className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 sm:px-6 lg:px-12">
          {children}
        </div>
      </main>
    </div>
  )
}
