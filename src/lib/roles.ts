import type { UserRole } from '@/types/crm'

export const isSuperadmin = (role?: UserRole | null) => role === 'admin'
export const canManageTeam = (role?: UserRole | null) => role === 'admin' || role === 'owner'

export const roleLabel: Record<UserRole, string> = {
  admin: 'Superadmin',
  owner: 'Dono',
  user: 'Usuário',
}
