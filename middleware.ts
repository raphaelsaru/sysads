import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ALLOWED_ORIGINS = [
  'https://web.whatsapp.com',
  'http://localhost:3000',
  'https://www.prizely.com.br',
  'https://prizely.com.br',
]

function isOriginAllowed(origin: string): boolean {
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('http://localhost:') ||
    origin.includes('prizely.com.br')
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const origin = request.headers.get('origin')
  const method = request.method

  // Tratar preflight requests (OPTIONS) para rotas da API com CORS
  if (method === 'OPTIONS' && pathname.startsWith('/api/')) {
    if (!origin || !isOriginAllowed(origin)) {
      return new NextResponse(null, { status: 403 })
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Sempre permitir recursos estáticos
  const isStatic =
    pathname.startsWith('/_next') ||
    pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot)$/)

  if (isStatic) {
    return NextResponse.next()
  }

  // Rotas da API têm sua própria auth — não redirecionar
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Rotas públicas
  const publicPaths = ['/', '/auth/login', '/auth/callback', '/auth/signup']
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path))
  if (isPublicPath) {
    return NextResponse.next()
  }

  // Para rotas protegidas, verificar auth
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Buscar perfil do usuário para role/onboarding checks
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    // Super admin pode acessar tudo
    if (profile.role === 'admin_global') {
      return supabaseResponse
    }

    // Usuários sem tenant — permitir por enquanto
    if (!profile.tenant_id) {
      return supabaseResponse
    }

    // Verificar onboarding do tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_completed')
      .eq('id', profile.tenant_id)
      .single()

    if (!tenant?.onboarding_completed && !pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    if (tenant?.onboarding_completed && pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Proteger rotas de super admin
    if (pathname.startsWith('/admin') && profile.role !== 'admin_global') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Proteger rotas de configuração (apenas admins)
    if (pathname.startsWith('/settings/users') || pathname.startsWith('/settings/branding')) {
      if (profile.role !== 'tenant_admin' && profile.role !== 'admin_global') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  } catch (error) {
    console.error('Erro crítico no middleware:', error)
    // Fail-closed: redirecionar para login em caso de erro
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
