import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Lista de caminhos públicos que não precisam de autenticação
  const publicPaths = ['/', '/auth/login', '/auth/callback', '/auth/signup']
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path))
  
  // Sempre permitir recursos estáticos e API routes SEM verificação de auth
  const isStaticOrApi = 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') ||
    pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot)$/)
  
  if (isStaticOrApi) {
    return NextResponse.next()
  }

  // Se é caminho público, permitir sem verificação
  if (isPublicPath) {
    return NextResponse.next()
  }

  // Para rotas protegidas, verificar auth
  let supabaseResponse = NextResponse.next({
    request,
  })

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

    const { data, error } = await supabase.auth.getUser()
    
    // Se há erro ou não há usuário, redirecionar
    if (error || !data.user) {
      console.log('Middleware: sem usuário autenticado, redirecionando para login')
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Usuário autenticado, permitir acesso
    return supabaseResponse
  } catch (error) {
    console.error('Erro crítico no middleware:', error)
    // Em caso de erro, redirecionar para login
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }
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
