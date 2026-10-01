import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { areaDaRota, homePath, pode } from '@/lib/permissions'
import type { UserRole } from '@/types/crm'

const ALLOWED_ORIGINS = [
  'https://web.whatsapp.com',
  'http://localhost:3000',
  'https://www.prizely.com.br',
  'https://prizely.com.br',
]

function isOriginAllowed(origin: string): boolean {
  try {
    const url = new URL(origin)
    return (
      ALLOWED_ORIGINS.includes(origin) ||
      origin.startsWith('chrome-extension://') ||
      url.hostname === 'localhost' ||
      url.hostname === 'prizely.com.br' ||
      url.hostname.endsWith('.prizely.com.br')
    )
  } catch {
    return false
  }
}

// Rota exata ou sub-rota (evita que '/empresa' case com '/empresas')
function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(base + '/')
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const origin = request.headers.get('origin')
  const method = request.method

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

  const isStatic =
    pathname.startsWith('/_next') ||
    pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot)$/)

  if (isStatic) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const publicPaths = [
    '/auth/login',
    '/auth/callback',
    '/auth/definir-senha',
    '/auth/desativado',
    '/privacidade',
    '/exclusao-de-dados',
    '/brandbook',
  ]
  const isPublicPath = publicPaths.some(path => matches(pathname, path))
  if (isPublicPath) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  // Redirect que preserva cookies de sessão renovados pelo Supabase
  const redirectTo = (path: string, search = '') => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = search
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    return response
  }

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
      return redirectTo('/auth/login', `?redirect=${encodeURIComponent(pathname)}`)
    }

    // Bloqueia usuário/empresa inativos ou sem vínculo
    // Erro transitório na RPC não desloga — RLS continua protegendo os dados
    const { data: acesso, error: acessoError } = await supabase.rpc('acesso_crm')
    if (acessoError) {
      console.error('Erro ao verificar acesso_crm:', acessoError)
    } else if (acesso !== 'ok') {
      return redirectTo('/auth/desativado', `?motivo=${encodeURIComponent(String(acesso ?? 'sem_perfil'))}`)
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()
    const role = profile?.role as UserRole | undefined

    // Home depende do perfil
    if (pathname === '/') {
      return redirectTo(homePath(role))
    }

    // Guarda por área (matriz em src/lib/permissions.ts)
    const area = areaDaRota(pathname)
    if (area && !pode(role, area)) {
      return redirectTo(homePath(role))
    }

    return supabaseResponse
  } catch {
    return redirectTo('/auth/login')
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
