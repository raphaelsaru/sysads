'use client'
// Seletor de empresa (só superadmin). Troca active_tenant_id e recarrega.

import { useEffect, useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isSuperadmin } from '@/lib/roles'

interface EmpresaOpcao {
  id: string
  name: string
  is_active: boolean
}

export default function EmpresaSwitcher() {
  const { userProfile, tenant } = useAuth()
  const superadmin = isSuperadmin(userProfile?.role)
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([])
  const [trocando, setTrocando] = useState(false)

  useEffect(() => {
    if (!superadmin) return
    let cancelado = false
    const carregar = async () => {
      try {
        const res = await fetch('/api/admin/empresas')
        if (!res.ok || cancelado) return
        const data = await res.json()
        if (!cancelado) setEmpresas((data.empresas || []) as EmpresaOpcao[])
      } catch {}
    }
    carregar()
    return () => { cancelado = true }
  }, [superadmin])

  if (!superadmin || !tenant || !userProfile) return null

  const visitando = tenant.id !== userProfile.tenant_id
  // Garante que a empresa atual aparece mesmo se a lista falhar
  const opcoes = empresas.some((e) => e.id === tenant.id)
    ? empresas
    : [{ id: tenant.id, name: tenant.name, is_active: tenant.is_active }, ...empresas]

  const trocar = async (id: string) => {
    if (id === tenant.id) return
    setTrocando(true)
    try {
      const res = await fetch('/api/admin/empresa-ativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: id === userProfile.tenant_id ? null : id }),
      })
      if (!res.ok) throw new Error('Falha ao trocar de empresa')
      // Recarrega tudo para os hooks buscarem os dados da nova empresa
      window.location.href = '/'
    } catch {
      alert('Erro ao trocar de empresa')
      setTrocando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Select value={tenant.id} onValueChange={trocar} disabled={trocando}>
        <SelectTrigger aria-label="Empresa">
          <SelectValue placeholder="Selecione a empresa" />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((empresa) => (
            <SelectItem key={empresa.id} value={empresa.id}>
              {empresa.name}
              {!empresa.is_active ? ' (inativa)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {visitando && (
        <Badge variant="destructive" className="w-fit">
          Visitando: {tenant.name}
        </Badge>
      )}
    </div>
  )
}
