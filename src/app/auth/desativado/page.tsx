'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const MENSAGENS: Record<string, string> = {
  usuario_inativo: 'Sua conta foi desativada.',
  empresa_inativa: 'O acesso da sua empresa está desativado.',
  sem_empresa: 'Sua conta não está vinculada a nenhuma empresa.',
  sem_perfil: 'Não encontramos seu perfil.',
}

function DesativadoConteudo() {
  const motivo = useSearchParams().get('motivo') ?? 'sem_perfil'

  useEffect(() => {
    void createClient().auth.signOut({ scope: 'local' })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-3">
          <CardTitle>Acesso indisponível</CardTitle>
          <CardDescription>
            {MENSAGENS[motivo] ?? MENSAGENS.sem_perfil} Entre em contato com o administrador.
          </CardDescription>
          <Button variant="outline" onClick={() => { window.location.href = '/auth/login' }}>
            Voltar ao login
          </Button>
        </CardHeader>
      </Card>
    </div>
  )
}

export default function DesativadoPage() {
  return (
    <Suspense fallback={null}>
      <DesativadoConteudo />
    </Suspense>
  )
}
