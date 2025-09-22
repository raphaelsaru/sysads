'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [authError, setAuthError] = useState(false)
  const [timeoutReached, setTimeoutReached] = useState(false)

  useEffect(() => {
    // Timeout de 15 segundos para detectar loading infinito
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timeout detected')
        setTimeoutReached(true)
      }
    }, 15000)

    return () => clearTimeout(timeout)
  }, [loading])

  useEffect(() => {
    // Se não está carregando e não há usuário, verificar se há erro
    if (!loading && !user) {
      // Aguardar um pouco para ver se o erro é temporário
      const checkAuth = setTimeout(() => {
        setAuthError(true)
      }, 2000)

      return () => clearTimeout(checkAuth)
    }
  }, [loading, user])

  // Se está carregando e não atingiu timeout, mostrar loading normal
  if (loading && !timeoutReached) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Verificando autenticação</h2>
            <p className="text-sm text-muted-foreground">Aguarde um momento...</p>
          </div>
        </div>
      </div>
    )
  }

  // Se atingiu timeout ou há erro de auth, mostrar tela de recuperação
  if (timeoutReached || authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Prizely CRM
            </span>
          </div>

          <Card className="border-border/80 bg-card/80 shadow-soft">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
                <AlertCircle className="h-8 w-8 text-warning" />
              </div>
              <CardTitle className="text-2xl font-semibold text-foreground">
                Problema de Conexão
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {timeoutReached 
                  ? 'A verificação de autenticação está demorando mais que o esperado.'
                  : 'Não foi possível verificar sua sessão automaticamente.'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Alert className="border-warning/40 bg-warning/10 text-warning">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Isso pode acontecer quando você fica muito tempo sem usar o sistema.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setAuthError(false)
                    setTimeoutReached(false)
                    window.location.reload()
                  }}
                  className="w-full"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tentar Novamente
                  </span>
                </Button>

                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="w-full"
                >
                  Ir para Login
                </Button>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                <p>Se o problema persistir, tente fazer login novamente.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Se há usuário autenticado, renderizar children
  if (user) {
    return <>{children}</>
  }

  // Se não há usuário e não está carregando, redirecionar para login
  if (!loading && !user) {
    router.push('/')
    return null
  }

  return null
}
