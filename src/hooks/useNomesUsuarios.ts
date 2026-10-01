'use client'

import { useEffect, useState } from 'react'

// Mapa userId → nome dos usuários da empresa (via /api/empresa/usuarios).
// Só busca quando `ativo`; `tenantId` força recarga ao trocar de empresa.
export function useNomesUsuarios(ativo: boolean, tenantId?: string | null) {
  const [nomesPorUsuario, setNomesPorUsuario] = useState<Record<string, string>>({})

  useEffect(() => {
    setNomesPorUsuario({})
    if (!ativo) return
    let cancelado = false
    fetch('/api/empresa/usuarios')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelado || !data?.usuarios) return
        const mapa: Record<string, string> = {}
        for (const u of data.usuarios as { id: string; full_name: string | null; email: string | null }[]) {
          mapa[u.id] = u.full_name ?? u.email ?? 'Sem nome'
        }
        setNomesPorUsuario(mapa)
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [ativo, tenantId])

  return nomesPorUsuario
}
