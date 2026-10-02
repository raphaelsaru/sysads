'use client'

import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import CardsArtistas from '@/components/equipe/CardsArtistas'

// Home do vendedor: escolhe o artista que vai atender (opera "visualizando como" ele).
export default function AtendimentoPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <CardsArtistas
          fonte="/api/vendedor/artistas"
          destino="/leads"
          selo="Atendimento"
          descricao="Escolha o artista que você vai atender."
          vazio={{ titulo: 'Nenhum artista vinculado', texto: 'Peça ao dono da empresa para vincular os artistas que você atende.' }}
          entrarSeUnico
        />
      </MainLayout>
    </ProtectedRoute>
  )
}
