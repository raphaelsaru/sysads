'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import AssistantPanel from './AssistantPanel'

export default function AssistantFab() {
  const { userProfile } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Flag só cosmética: a VPS revalida o acesso em toda requisição.
  const habilitado = userProfile?.preferences?.assistant_enabled === true
  const rotaPublica = !pathname || pathname.startsWith('/auth')

  if (!habilitado || rotaPublica) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.35),0_12px_28px_-8px_hsl(var(--primary)/0.7)] transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.96]"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}
      <AssistantPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
