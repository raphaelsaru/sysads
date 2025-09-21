'use client'

import { ReactNode } from 'react'

import Header from './Header'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background">
      <Header />

      <main className="pb-12 pt-12">
        <div className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 sm:px-6 lg:px-12">
          {children}
        </div>
      </main>
    </div>
  )
}
