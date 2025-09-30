'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const supabase = createClient()
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          setStatus('error')
          setMessage('Erro ao confirmar email. Tente novamente.')
          return
        }

        if (data.session?.user) {
          setStatus('success')
          setMessage('Email confirmado com sucesso! Redirecionando...')
          
          // Aguardar um pouco para mostrar a mensagem de sucesso
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else {
          setStatus('error')
          setMessage('Sessão não encontrada. Tente fazer login novamente.')
        }
      } catch {
        setStatus('error')
        setMessage('Erro inesperado. Tente novamente.')
      }
    }

    handleAuthCallback()
  }, [router])

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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {status === 'loading' && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
              {status === 'success' && <CheckCircle className="h-8 w-8 text-success" />}
              {status === 'error' && <AlertCircle className="h-8 w-8 text-destructive" />}
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {status === 'loading' && 'Processando...'}
              {status === 'success' && 'Email confirmado!'}
              {status === 'error' && 'Erro na confirmação'}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {message}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {status === 'error' && (
              <div className="space-y-4">
                <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
                
                <Button
                  onClick={() => router.push('/')}
                  className="w-full"
                >
                  Voltar ao login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
