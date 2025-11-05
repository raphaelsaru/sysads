'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Tenant, TenantBranding } from '@/types/crm'
import { applyTenantColors, resetTenantColors } from '@/lib/color-utils'

interface TenantContextType {
  tenant: Tenant | null
  branding: TenantBranding | null
  loading: boolean
  refreshTenant: () => Promise<void>
  updateBranding: (branding: Partial<TenantBranding>) => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

interface TenantProviderProps {
  children: ReactNode
  tenantId?: string | null
}

export function TenantProvider({ children, tenantId }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTenant = async (id: string) => {
    try {
      setLoading(true)
      console.log('🏢 Buscando dados do tenant:', id)

      const response = await fetch(`/api/tenant/${id}`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar tenant')
      }

      const data = await response.json()
      setTenant(data.tenant)
      setBranding(data.tenant.branding)

      // Aplicar tema do tenant
      if (data.tenant.branding?.primaryColor && data.tenant.branding?.secondaryColor) {
        applyTenantColors(
          data.tenant.branding.primaryColor,
          data.tenant.branding.secondaryColor
        )
      }

      console.log('✅ Tenant carregado:', data.tenant.name)
    } catch (error) {
      console.error('❌ Erro ao carregar tenant:', error)
      // Aplicar cores padrão em caso de erro
      resetTenantColors()
    } finally {
      setLoading(false)
    }
  }

  const refreshTenant = async () => {
    if (tenantId) {
      await fetchTenant(tenantId)
    }
  }

  const updateBranding = (newBranding: Partial<TenantBranding>) => {
    if (!branding) return

    const updatedBranding = { ...branding, ...newBranding }
    setBranding(updatedBranding)

    // Atualizar tenant também
    if (tenant) {
      setTenant({ ...tenant, branding: updatedBranding })
    }

    // Aplicar novas cores se foram alteradas
    if (newBranding.primaryColor || newBranding.secondaryColor) {
      const primary = newBranding.primaryColor || branding.primaryColor
      const secondary = newBranding.secondaryColor || branding.secondaryColor
      applyTenantColors(primary, secondary)
    }
  }

  useEffect(() => {
    if (tenantId) {
      fetchTenant(tenantId)
    } else {
      setLoading(false)
      setTenant(null)
      setBranding(null)
      resetTenantColors()
    }

    // Cleanup ao desmontar
    return () => {
      // Não resetar cores aqui pois pode causar flicker
    }
  }, [tenantId])

  return (
    <TenantContext.Provider
      value={{
        tenant,
        branding,
        loading,
        refreshTenant,
        updateBranding,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}


