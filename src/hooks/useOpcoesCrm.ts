import { useAuth } from '@/contexts/AuthContext'
import { opcoesCrm, type OpcoesCrm } from '@/lib/crm-preset'

/** Opções dos forms da empresa ativa (preset em `tenants.crm_preset`). */
export function useOpcoesCrm(): OpcoesCrm {
  const { tenant } = useAuth()
  return opcoesCrm(tenant?.crm_preset)
}
