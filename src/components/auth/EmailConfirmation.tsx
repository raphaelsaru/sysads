'use client'

import { useState } from 'react'
import { Mail, CheckCircle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'

interface EmailConfirmationProps {
  email: string
  onBack: () => void
}

export default function EmailConfirmation({ email, onBack }: EmailConfirmationProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resendConfirmation = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

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
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Confirme seu email
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <h3 className="font-semibold text-foreground mb-2">📧 Próximos passos:</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Verifique sua caixa de entrada</li>
                  <li>Clique no link de confirmação</li>
                  <li>Volte aqui e faça login</li>
                </ol>
              </div>

              {success && (
                <Alert className="border-success/40 bg-success/10 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email reenviado com sucesso! Verifique sua caixa de entrada.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Button
                  onClick={resendConfirmation}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Reenviando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Reenviar email
                    </span>
                  )}
                </Button>

                <Button
                  onClick={onBack}
                  variant="ghost"
                  className="w-full"
                >
                  <span className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </span>
                </Button>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <p>Não recebeu o email? Verifique sua pasta de spam.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
