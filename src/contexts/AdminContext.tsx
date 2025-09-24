'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useAuth, UserProfile } from '@/contexts/AuthContext'

interface ImpersonationState {
  isImpersonating: boolean
  originalUser: UserProfile | null
  impersonatedUser: UserProfile | null
}

interface AdminContextType {
  impersonation: ImpersonationState
  startImpersonation: (targetUser: UserProfile) => void
  stopImpersonation: () => void
  isAdmin: boolean
  canImpersonate: boolean
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth()
  const [impersonation, setImpersonation] = useState<ImpersonationState>({
    isImpersonating: false,
    originalUser: null,
    impersonatedUser: null,
  })

  const isAdmin = userProfile?.role === 'admin'
  const canImpersonate = isAdmin && !impersonation.isImpersonating

  const startImpersonation = useCallback((targetUser: UserProfile) => {
    if (!isAdmin) {
      console.warn('Only admins can impersonate users')
      return
    }

    console.log(`Admin ${userProfile?.email} starting impersonation of ${targetUser.email}`)

    setImpersonation({
      isImpersonating: true,
      originalUser: userProfile,
      impersonatedUser: targetUser,
    })
  }, [isAdmin, userProfile])

  const stopImpersonation = useCallback(() => {
    console.log(`Stopping impersonation, returning to admin ${impersonation.originalUser?.email}`)

    setImpersonation({
      isImpersonating: false,
      originalUser: null,
      impersonatedUser: null,
    })
  }, [impersonation.originalUser])

  return (
    <AdminContext.Provider
      value={{
        impersonation,
        startImpersonation,
        stopImpersonation,
        isAdmin,
        canImpersonate,
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

// Hook para obter o usuário efetivo (impersonado ou original)
export function useEffectiveUser() {
  const { userProfile } = useAuth()
  const { impersonation } = useAdmin()

  return impersonation.isImpersonating ? impersonation.impersonatedUser : userProfile
}