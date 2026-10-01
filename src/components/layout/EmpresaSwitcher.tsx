'use client'
// Seletor de empresa (superadmin ou dono com várias empresas). Troca active_tenant_id e recarrega.

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

type Fonte = 'admin' | 'dono'
const URL_FONTE: Record<Fonte, string> = {
  admin: '/api/admin/empresas', // superadmin: todas
  dono: '/api/empresa/minhas',  // owner: primária + vinculadas
}

// Cache da lista na sessão, por fonte (evita refetch a cada abertura do drawer mobile)
const empresasCache: Record<Fonte, Promise<EmpresaOpcao[]> | null> = { admin: null, dono: null }

// Chamar após criar/renomear/ativar empresa: próxima montagem busca de novo.
export function invalidarCacheEmpresas() {
  empresasCache.admin = null
  empresasCache.dono = null
}

function carregarEmpresas(fonte: Fonte): Promise<EmpresaOpcao[]> {
  const cache = empresasCache[fonte]
  if (cache) return cache
  const atual: Promise<EmpresaOpcao[]> = fetch(URL_FONTE[fonte])
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return (data.empresas || []) as EmpresaOpcao[]
    })
    .catch((error) => {
      console.error('Erro ao carregar empresas:', error)
      if (empresasCache[fonte] === atual) empresasCache[fonte] = null // permite nova tentativa
      return []
    })
  empresasCache[fonte] = atual
  return atual
}

async function definirEmpresaAtiva(tenantId: string | null) {
  const res = await fetch('/api/admin/empresa-ativa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId }),
  })
  if (!res.ok) throw new Error('Falha ao trocar de empresa')
  // Recarrega tudo para os hooks buscarem os dados da nova empresa.
  // Visitando outra empresa → Equipe (home de dono); voltando à própria → home do perfil.
  window.location.href = tenantId ? '/equipe' : '/'
}

export default function EmpresaSwitcher() {
  const { userProfile, tenant } = useAuth()
  const superadmin = isSuperadmin(userProfile?.role)
  const owner = userProfile?.role === 'owner'
  const fonte: Fonte | null = superadmin ? 'admin' : owner ? 'dono' : null
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([])
  const [carregado, setCarregado] = useState(false)
  const [trocando, setTrocando] = useState(false)

  useEffect(() => {
    if (!fonte) return
    let cancelado = false
    carregarEmpresas(fonte).then((lista) => {
      if (cancelado) return
      setEmpresas(lista)
      setCarregado(true)
    })
    return () => { cancelado = true }
  }, [fonte])

  const trocarPara = async (tenantId: string | null) => {
    setTrocando(true)
    try {
      await definirEmpresaAtiva(tenantId)
    } catch {
      alert('Erro ao trocar de empresa')
      setTrocando(false)
    }
  }

  if (!fonte || !userProfile) return null

  const voltar = (
    <Button variant="outline" size="sm" disabled={trocando} onClick={() => { void trocarPara(null) }}>
      Voltar à minha empresa
    </Button>
  )

  // Saída de emergência: visitando empresa que não carregou
  if (!tenant) return userProfile.active_tenant_id ? voltar : null

  // Dono com uma só empresa: nada a trocar (lista falhou fora da primária: só o "voltar")
  if (owner && empresas.length <= 1) {
    if (!carregado || tenant.id === userProfile.tenant_id) return null
    return voltar
  }

  const visitando = superadmin && !!userProfile.tenant_id && tenant.id !== userProfile.tenant_id
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
