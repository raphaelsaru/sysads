/**
 * Helpers de autorização para o sistema multitenant
 */

import { UserRole } from '@/types/crm'
import { createClient } from '@/lib/supabase-server'

/**
 * Verifica se o usuário autenticado é super admin (admin_global)
 */
export async function checkIsSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return false
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    return profile?.role === 'admin_global'
  } catch (error) {
    console.error('Erro ao verificar super admin:', error)
    return false
  }
}

/**
 * Verifica se o usuário autenticado é tenant admin
 */
export async function checkIsTenantAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return false
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    return profile?.role === 'tenant_admin'
  } catch (error) {
    console.error('Erro ao verificar tenant admin:', error)
    return false
  }
}

/**
 * Verifica se o usuário tem acesso a um tenant específico
 */
export async function checkTenantAccess(tenantId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return false
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()
    
    if (!profile) return false
    
    // Super admin tem acesso a todos os tenants
    if (profile.role === 'admin_global') return true
    
    // Outros usuários só têm acesso ao próprio tenant
    return profile.tenant_id === tenantId
  } catch (error) {
    console.error('Erro ao verificar acesso ao tenant:', error)
    return false
  }
}

/**
 * Obtém o tenant_id do usuário autenticado
 */
export async function getUserTenantId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()
    
    return profile?.tenant_id || null
  } catch (error) {
    console.error('Erro ao obter tenant_id:', error)
    return null
  }
}

/**
 * Obtém a role do usuário autenticado
 */
export async function getUserRole(): Promise<UserRole | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    return profile?.role || null
  } catch (error) {
    console.error('Erro ao obter role:', error)
    return null
  }
}

/**
 * Verifica se o usuário tem pelo menos uma das roles especificadas
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const userRole = await getUserRole()
  if (!userRole) return false
  
  return roles.includes(userRole)
}

/**
 * Verifica se o usuário pode gerenciar outros usuários
 */
export async function canManageUsers(): Promise<boolean> {
  return await hasAnyRole(['admin_global', 'tenant_admin'])
}

/**
 * Verifica se o usuário pode gerenciar configurações do tenant
 */
export async function canManageTenantSettings(): Promise<boolean> {
  return await hasAnyRole(['admin_global', 'tenant_admin'])
}







