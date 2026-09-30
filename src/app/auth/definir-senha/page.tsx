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
  const tokenHash = useSearchParams().get('token_hash')
  const [status, setStatus] = useState<'verificando' | 'pronto' | 'erro'>(tokenHash ? 'verificando' : 'erro')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // token_hash só pode ser verificado uma vez; evita 2ª chamada no strict mode
  const verificou = useRef(false)

  useEffect(() => {
    if (!tokenHash || verificou.current) return
    verificou.current = true
    const token_hash = tokenHash

    const verificar = async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'invite' })
      if (!error) { setStatus('pronto'); return }
      // Recarregou a página após verificar: token já consumido, mas sessão existe
      const { data } = await supabase.auth.getUser()
      setStatus(data.user ? 'pronto' : 'erro')
    }
    void verificar()
  }, [tokenHash])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) return setErro('A senha deve ter no mínimo 8 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não conferem.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) return setErro(error.message)
    router.replace('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <CardTitle>Crie sua senha</CardTitle>
          <CardDescription>
            {status === 'verificando' && 'Validando convite...'}
            {status === 'erro' && 'Convite inválido ou expirado. Peça um novo convite ao administrador.'}
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
