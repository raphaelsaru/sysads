import type { createAdminClient } from '@/lib/supabase-admin'
import { getCaller, usuarioNaEmpresa } from '@/lib/tenant-server'
import { pode } from '@/lib/permissions'

// Agenda de outro usuário (mesma empresa): superadmin/dono/gestor, ou vendedor
// no artista que atende. Própria agenda é sempre permitida.
export async function podeVerAgenda(
  admin: ReturnType<typeof createAdminClient>, userId: string, targetUserId: string,
): Promise<boolean> {
  if (targetUserId === userId) return true
  const caller = await getCaller()
  if (!caller?.tenantId || !(await usuarioNaEmpresa(admin, targetUserId, caller.tenantId))) return false
  if (pode(caller.role, 'ver_empresa')) return true
  if (caller.role !== 'vendedor') return false
  const { data: vinculo } = await admin.from('vendedor_artistas').select('artista_id')
    .eq('vendedor_id', caller.userId).eq('artista_id', targetUserId).eq('tenant_id', caller.tenantId)
    .maybeSingle()
  return !!vinculo
}
