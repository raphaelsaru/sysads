'use client'

import { useState, useEffect } from 'react'
import { Loader2, LockKeyhole, Mail, Building2 } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import EmailConfirmation from './EmailConfirmation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const { signIn, signUp } = useAuth()

  // Carregar preferências salvas quando o componente monta
  useEffect(() => {
    const savedRememberMe = localStorage.getItem('prizely_remember_me')
    const savedEmail = localStorage.getItem('prizely_user_email')
    
    if (savedRememberMe === 'true' && savedEmail) {
      console.log('🔄 Carregando preferências salvas:', { email: savedEmail, rememberMe: true })
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let result
    if (isSignUp) {
      if (!companyName.trim()) {
        setError('Informe o nome da empresa para criar sua conta.')
        setLoading(false)
        return
      }
      result = await signUp(email, password, companyName)
      
      // Se o cadastro foi bem-sucedido, mostrar tela de confirmação
      if (!result.error) {
        setNeedsEmailConfirmation(true)
        setLoading(false)
        return
      }
    } else {
      result = await signIn(email, password, rememberMe)
    }

    if (result.error) {
      setError(result.error.message)
    }

    setLoading(false)
  }

  const handleBackToLogin = () => {
    setNeedsEmailConfirmation(false)
    // Não limpar email se lembrar-me estiver marcado
    if (!rememberMe) {
      setEmail('')
    }
    setPassword('')
    setCompanyName('')
    setError(null)
  }

  // Se precisa de confirmação de email, mostrar o componente de confirmação
  if (needsEmailConfirmation) {
    return <EmailConfirmation email={email} onBack={handleBackToLogin} />
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
            <CardTitle className="text-2xl font-semibold text-foreground">
              {isSignUp ? 'Crie sua conta exclusiva' : 'Boas-vindas de volta'}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {isSignUp
                ? 'Monte seu ambiente de relacionamento em poucos cliques.'
                : 'Acesse o painel e continue nutrindo seus relacionamentos.'}
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

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da empresa</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="companyName"
                      name="companyName"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="pl-10"
                      placeholder="Como seus clientes conhecem você"
                    />
                  </div>
                </div>
              )}

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

              {!isSignUp && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label
                      htmlFor="rememberMe"
                      className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Lembrar-me
                    </Label>
                  </div>
                  {rememberMe && email && (
                    <span className="text-xs text-muted-foreground">
                      Email salvo ✓
                    </span>
                  )}
                </div>
              )}

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
                    {isSignUp ? 'Criando ambiente...' : 'Entrando...'}
                  </span>
                ) : (
                  isSignUp ? 'Criar conta' : 'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <span>
                {isSignUp ? 'Já tem uma conta?' : 'Ainda não possui acesso?'}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-primary hover:text-primary"
                onClick={() => setIsSignUp((prev) => !prev)}
              >
                {isSignUp ? 'Faça login' : 'Crie sua conta agora'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}