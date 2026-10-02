'use client'

import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import CardsArtistas from '@/components/equipe/CardsArtistas'

// Home do dono: artistas da empresa; clique abre o painel do artista.
export default function EquipePage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <CardsArtistas
          fonte="/api/empresa/usuarios?ativos=1"
          destino="/dashboard"
          selo="Equipe"
          descricao="Resultados de cada artista. Clique para abrir o painel."
          vazio={{ titulo: 'Nenhum artista ativo', texto: 'Convide artistas em Minha empresa.' }}
        />
      </MainLayout>
    </ProtectedRoute>
  )
}
