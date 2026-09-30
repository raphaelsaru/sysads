'use client'
// Seletor de empresa (só superadmin). Troca active_tenant_id e recarrega.

import { useEffect, useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

// Cache da lista na sessão (evita refetch a cada abertura do drawer mobile)
let empresasCache: Promise<EmpresaOpcao[]> | null = null

// Chamar após criar/renomear/ativar empresa: próxima montagem busca de novo.
export function invalidarCacheEmpresas() {
  empresasCache = null
}

function carregarEmpresas(): Promise<EmpresaOpcao[]> {
  if (!empresasCache) {
    const atual: Promise<EmpresaOpcao[]> = fetch('/api/admin/empresas')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return (data.empresas || []) as EmpresaOpcao[]
      })
      .catch((error) => {
        console.error('Erro ao carregar empresas:', error)
        if (empresasCache === atual) empresasCache = null // permite nova tentativa
        return []
      })
    empresasCache = atual
  }
  return empresasCache
}

async function definirEmpresaAtiva(tenantId: string | null) {
  const res = await fetch('/api/admin/empresa-ativa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId }),
  })
  if (!res.ok) throw new Error('Falha ao trocar de empresa')
  // Recarrega tudo para os hooks buscarem os dados da nova empresa
  window.location.href = '/'
}

export default function EmpresaSwitcher() {
  const { userProfile, tenant } = useAuth()
  const superadmin = isSuperadmin(userProfile?.role)
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([])
  const [trocando, setTrocando] = useState(false)

  useEffect(() => {
    if (!superadmin) return
    let cancelado = false
    carregarEmpresas().then((lista) => {
      if (!cancelado) setEmpresas(lista)
    })
    return () => { cancelado = true }
  }, [superadmin])

  const trocarPara = async (tenantId: string | null) => {
    setTrocando(true)
    try {
      await definirEmpresaAtiva(tenantId)
    } catch {
      alert('Erro ao trocar de empresa')
      setTrocando(false)
    }
  }

  if (!superadmin || !userProfile) return null

  // Saída de emergência: visitando empresa que não carregou
  if (!tenant) {
    if (!userProfile.active_tenant_id) return null
    return (
      <Button variant="outline" size="sm" disabled={trocando} onClick={() => { void trocarPara(null) }}>
        Voltar à minha empresa
      </Button>
    )
  }

  const visitando = !!userProfile.tenant_id && tenant.id !== userProfile.tenant_id
  // Garante que a empresa atual aparece mesmo se a lista falhar
  const opcoes = empresas.some((e) => e.id === tenant.id)
    ? empresas
    : [{ id: tenant.id, name: tenant.name, is_active: tenant.is_active }, ...empresas]

  const trocar = (id: string) => {
    if (id === tenant.id) return
    void trocarPara(id === userProfile.tenant_id ? null : id)
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
