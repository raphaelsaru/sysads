import { UserRole } from '@/types/crm'
import { createClient } from '@/lib/supabase-server'

export async function checkIsAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return profile?.role === 'admin'
  } catch {
    return false
  }
}

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
  } catch {
    return null
  }
}

export async function canManageUsers(): Promise<boolean> {
  return await checkIsAdmin()
}
