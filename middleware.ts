import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Lista de caminhos públicos que não precisam de autenticação
  const publicPaths = ['/', '/auth/login', '/auth/callback', '/auth/signup']
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path))
  
  // Sempre permitir recursos estáticos, API routes e caminhos públicos sem verificação de auth
  const isStaticResource = pathname.startsWith('/_next') || 
                          pathname.startsWith('/api') ||
                          pathname.includes('.')
  
  // Para recursos estáticos e APIs, retornar sem verificação de autenticação
  if (isStaticResource) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    
    if (error) {
      console.warn('Erro ao obter usuário no middleware:', error.message)
      // Se o erro é de sessão, tentar refresh
      if (error.message.includes('refresh') || error.message.includes('invalid')) {
        console.log('Tentando refresh de sessão no middleware...')
        const { data: refreshData } = await supabase.auth.refreshSession()
        user = refreshData.session?.user ?? null
      }
    } else {
      user = data.user
    }
  } catch (error) {
    console.error('Erro crítico ao obter usuário no middleware:', error)
  }

  // Se é um caminho público, permitir acesso sem redirecionamento
  if (isPublicPath) {
    return supabaseResponse
  }

  // Only redirect for protected routes
  if (!user) {
    // no user, redirect to login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so: myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object instead of the supabaseResponse object

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
