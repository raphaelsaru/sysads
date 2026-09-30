'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface ImpersonatedUser {
  id: string
  email: string
  company_name: string
  currency: string
}

interface AdminContextType {
  impersonatedUserId: string | null
  impersonatedUser: ImpersonatedUser | null
  startImpersonation: (user: ImpersonatedUser) => void
  stopImpersonation: () => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null)
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null)

  const startImpersonation = useCallback((user: ImpersonatedUser) => {
    setImpersonatedUserId(user.id)
    setImpersonatedUser(user)
  }, [])

  const stopImpersonation = useCallback(() => {
    setImpersonatedUserId(null)
    setImpersonatedUser(null)
  }, [])

  // Trocou de empresa: encerra "visualizar como" (usuário pertence à empresa anterior).
  const { tenant } = useAuth()
  const tenantId = tenant?.id ?? null
  const tenantAnteriorRef = useRef(tenantId)
  useEffect(() => {
    const anterior = tenantAnteriorRef.current
    tenantAnteriorRef.current = tenantId
    if (anterior !== null && anterior !== tenantId) stopImpersonation()
  }, [tenantId, stopImpersonation])

  return (
    <AdminContext.Provider
      value={{ impersonatedUserId, impersonatedUser, startImpersonation, stopImpersonation }}
    >
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}
