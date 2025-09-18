'use client'

import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LoginForm from './LoginForm'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md border-border/70 bg-card/70 shadow-soft">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Preparando seu workspace
            </CardTitle>
            <CardDescription>
              Em instantes você terá acesso ao painel completo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 animate-pulse rounded-full bg-primary/20" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return <>{children}</>
}
