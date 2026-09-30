'use client'

import { useState, useEffect } from 'react'
import { Loader2, LockKeyhole, Mail } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Symbol } from '@/components/ui/symbol'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signIn, user, loading: authLoading } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn(email, password)

    // Se o login foi bem-sucedido, o useEffect cuida do redirecionamento
    // quando o user for atualizado no contexto
    if (result.error) {
      setError(result.error.message)
    }

    setLoading(false)
  }

  // Redirecionar automaticamente quando o usuário estiver autenticado
  useEffect(() => {
    if (!authLoading && user) {
      // Usar window.location para garantir um reload completo e que o middleware seja executado
      window.location.href = '/dashboard'
    }
  }, [user, authLoading])

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <Symbol className="h-10 w-10 shrink-0" />
            <span className="font-display text-4xl font-medium text-foreground">Prizely</span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Prizely CRM
          </span>
        </div>

 <Card>
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-semibold text-foreground">
              Boas-vindas de volta
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Acesse o painel e continue nutrindo seus relacionamentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="voce@empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    placeholder="Digite sua senha"
                  />
                </div>
              </div>

              {error && (
                <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                  <AlertTitle>Ops, algo deu errado</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full h-12 rounded-full bg-primary text-primary-foreground shadow-brand hover:bg-primary/90"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Acesso somente por convite.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}