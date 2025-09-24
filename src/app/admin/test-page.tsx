'use client'

import { useState } from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'

function TestPageContent() {
  const { userProfile } = useAuth()
  const [test, setTest] = useState('Hello World')

  if (userProfile?.role !== 'admin') {
    return (
      <MainLayout>
        <section className="py-24 text-center">
          <div className="mx-auto max-w-md space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground">
              Você não possui permissão para acessar esta área.
            </p>
          </div>
        </section>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <section className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Teste</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Página de teste para verificar se há problemas de sintaxe.
          </p>
        </header>
        
        <div className="p-4 border rounded-lg">
          <p>Teste: {test}</p>
          <button 
            onClick={() => setTest('Teste atualizado!')}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Atualizar
          </button>
        </div>
      </section>
    </MainLayout>
  )
}

export default function TestPage() {
  return (
    <ProtectedRoute>
      <TestPageContent />
    </ProtectedRoute>
  )
}
