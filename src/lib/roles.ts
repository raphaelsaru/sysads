import type { UserRole } from '@/types/crm'
import { pode } from '@/lib/permissions'

export const isSuperadmin = (role?: UserRole | null) => role === 'admin'
export const canManageTeam = (role?: UserRole | null) => pode(role, 'equipe')

export const roleLabel: Record<UserRole, string> = {
  admin: 'Superadmin',
  owner: 'Dono',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  user: 'Artista',
}

// Papéis que o dono pode atribuir na própria empresa.
export const ROLES_CONVIDAVEIS = ['gestor', 'vendedor', 'user'] as const
export type RoleConvidavel = typeof ROLES_CONVIDAVEIS[number]
export const isRoleConvidavel = (r: unknown): r is RoleConvidavel =>
  typeof r === 'string' && (ROLES_CONVIDAVEIS as readonly string[]).includes(r)
