'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

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
    console.log('🎭 Iniciando impersonação:', user.email)
    setImpersonatedUserId(user.id)
    setImpersonatedUser(user)
  }, [])

  const stopImpersonation = useCallback(() => {
    console.log('🎭 Parando impersonação')
    setImpersonatedUserId(null)
    setImpersonatedUser(null)
  }, [])

  return (
    <AdminContext.Provider
      value={{
        impersonatedUserId,
        impersonatedUser,
        startImpersonation,
        stopImpersonation,
      }}
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
