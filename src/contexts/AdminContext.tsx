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
  // true após ler o "visualizar como" salvo (guardas esperam p/ não redirecionar cedo)
  pronto: boolean
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

// Sobrevive a reload (vendedor sempre opera "visualizando como" um artista).
const STORAGE_KEY = 'prizely:visualizar-como'

function lerSalvo(): ImpersonatedUser | null {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null
    return raw ? (JSON.parse(raw) as ImpersonatedUser) : null
  } catch {
    return null
  }
}

function salvar(user: ImpersonatedUser | null) {
  try {
    if (user) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null)
  const impersonatedUserId = impersonatedUser?.id ?? null

  const [pronto, setPronto] = useState(false)

  // Lê após montar (evita divergência de hidratação)
  useEffect(() => {
    const salvo = lerSalvo()
    if (salvo) setImpersonatedUser(salvo)
    setPronto(true)
  }, [])

  const startImpersonation = useCallback((user: ImpersonatedUser) => {
    setImpersonatedUser(user)
    salvar(user)
  }, [])

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null)
    salvar(null)
  }, [])

  // Saiu da conta: limpa (próximo login na mesma aba não herda)
  const { tenant, user, loading } = useAuth()
  useEffect(() => {
    if (!loading && !user) stopImpersonation()
  }, [loading, user, stopImpersonation])

  // Trocou de empresa: encerra "visualizar como" (usuário pertence à empresa anterior).
  const tenantId = tenant?.id ?? null
  const tenantAnteriorRef = useRef(tenantId)
  useEffect(() => {
    const anterior = tenantAnteriorRef.current
    tenantAnteriorRef.current = tenantId
    if (anterior !== null && anterior !== tenantId) stopImpersonation()
  }, [tenantId, stopImpersonation])

  return (
    <AdminContext.Provider
      value={{ impersonatedUserId, impersonatedUser, startImpersonation, stopImpersonation, pronto }}
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
