import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * Middleware para verificar autenticação, onboarding e proteger rotas
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/auth/login', '/auth/callback']
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Rotas da API não precisam de middleware de redirect (têm sua própria auth)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Se não estiver autenticado, redirecionar para login
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    // Se não tiver perfil, há algo errado - redirecionar para login
    if (!profile) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    // Super admin (admin_global) não precisa de tenant nem onboarding
    if (profile.role === 'admin_global') {
      // Admin global pode acessar todas as rotas
      return NextResponse.next()
    }

    // Usuários sem tenant devem ser redirecionados para uma página de erro
    if (!profile.tenant_id) {
      // Por enquanto, permitir acesso (pode ser que o super admin ainda não associou a um tenant)
      // Em produção, você pode querer uma página de "Aguardando configuração"
      return NextResponse.next()
    }

    // Verificar se o tenant completou o onboarding
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_completed')
      .eq('id', profile.tenant_id)
      .single()

    // Se onboarding não foi completado, redirecionar para /onboarding
    // Exceto se já estiver na página de onboarding
    if (!tenant?.onboarding_completed && !pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // Se onboarding foi completado, não permitir acesso à página de onboarding
    if (tenant?.onboarding_completed && pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Proteger rotas de super admin
    if (pathname.startsWith('/admin')) {
      if (profile.role !== 'admin_global') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Proteger rotas de configuração (apenas admins)
    if (pathname.startsWith('/settings/users') || pathname.startsWith('/settings/branding')) {
      if (profile.role !== 'tenant_admin' && profile.role !== 'admin_global') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Erro no middleware:', error)
    // Em caso de erro, permitir acesso (para não quebrar o sistema)
    return NextResponse.next()
  }
}

// Configurar quais rotas o middleware deve processar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


