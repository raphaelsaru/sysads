import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getCaller } from '@/lib/tenant-server'
import { homePath } from '@/lib/permissions'

// Fallback: o middleware já redireciona '/' p/ a home do perfil.
export default async function Home() {
  const caller = await getCaller()
  redirect((caller ? homePath(caller.role) : '/auth/login') as Route)
}
