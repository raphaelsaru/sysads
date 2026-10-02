'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'

// Vendedor não tem dados próprios: sem artista escolhido, só /atendimento e conexões.
const LIVRES_SEM_ARTISTA = ['/atendimento', '/settings/integrations']

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { userProfile } = useAuth()
  const { impersonatedUserId, pronto } = useAdmin()
  const pathname = usePathname()
  const router = useRouter()
  const vendedorSemArtista =
    pronto && userProfile?.role === 'vendedor' && !impersonatedUserId && !LIVRES_SEM_ARTISTA.includes(pathname)

  useEffect(() => {
    if (vendedorSemArtista) router.replace('/atendimento')
  }, [vendedorSemArtista, router])

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
