'use client'

import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import LoginForm from './LoginForm'
import AuthGuard from './AuthGuard'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  // Se está carregando, mostrar loading mínimo
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  // Se não há usuário, mostrar login
  if (!user) {
    return <LoginForm />
  }

  // Se há usuário, usar AuthGuard para proteção adicional
  return <AuthGuard>{children}</AuthGuard>
}