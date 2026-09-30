'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const supabase = createClient()

function DefinirSenha() {
  const router = useRouter()
  const params = useSearchParams()
  const tokenHash = params.get('token_hash')
  const tipoParam = params.get('type')
  const tipo = tipoParam === 'invite' || tipoParam === 'recovery' ? tipoParam : null
  const [recuperacao, setRecuperacao] = useState(tipo === 'recovery')
  const [status, setStatus] = useState<'verificando' | 'pronto' | 'erro'>('verificando')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // token_hash só pode ser verificado uma vez; evita 2ª chamada no strict mode
  const verificou = useRef(false)

  useEffect(() => {
    if (verificou.current) return
    verificou.current = true

    const verificar = async () => {
      if (tokenHash && tipo) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
        setStatus(error ? 'erro' : 'pronto')
        return
      }

      // O template padrão do Supabase pode estabelecer a sessão pelo callback
      // (PKCE/fragmento) em vez de enviar token_hash diretamente para esta página.
      // getSession aguarda a inicialização do client e cobre esse formato também.
      if (!tokenHash && !tipoParam) {
        const { data, error } = await supabase.auth.getSession()
        if (!error && data.session) {
          setRecuperacao(true)
          setStatus('pronto')
          return
        }
      }

      setStatus('erro')
    }
    void verificar()
  }, [tokenHash, tipo, tipoParam])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) return setErro('A senha deve ter no mínimo 8 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não conferem.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      console.error('Erro ao definir senha:', error)
      setSalvando(false)
      const fraca = error.code === 'weak_password'
        || error.message.includes('weak')
        || error.message.includes('Password should')
      return setErro(fraca
        ? 'Senha fraca. Use pelo menos 8 caracteres com letras e números.'
        : recuperacao
          ? 'Não foi possível salvar a senha. Tente outra senha ou peça um novo link.'
          : 'Não foi possível salvar a senha. Tente outra senha ou peça um novo convite.')
    }
    router.replace('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <CardTitle>{recuperacao ? 'Redefinir senha' : 'Crie sua senha'}</CardTitle>
          <CardDescription>
            {status === 'verificando' && (recuperacao ? 'Validando link...' : 'Validando convite...')}
            {status === 'erro' && (recuperacao
              ? 'Link inválido ou expirado. Solicite uma nova redefinição de senha na tela de login.'
              : 'Convite inválido ou expirado. Peça um novo convite ao administrador.')}
            {status === 'pronto' && 'Defina a senha para acessar o CRM.'}
          </CardDescription>
          {status === 'erro' && (
            <Button variant="outline" onClick={() => { window.location.href = '/auth/login' }}>
              Voltar ao login
            </Button>
          )}
        </CardHeader>
        {status === 'pronto' && (
          <CardContent>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacao">Confirmar senha</Label>
                <Input
                  id="confirmacao"
                  type="password"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={e => setConfirmacao(e.target.value)}
                />
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button type="submit" className="w-full" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar e entrar'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default function DefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <DefinirSenha />
    </Suspense>
  )
}
