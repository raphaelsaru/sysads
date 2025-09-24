'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, createSupabaseClient } from '@/lib/supabase'
import ConnectionFallback from '@/components/auth/ConnectionFallback'

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'user'
  currency: 'BRL' | 'USD' | 'EUR'
  company_name: string
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  showConnectionFallback: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, companyName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>
  retryConnection: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConnectionFallback, setShowConnectionFallback] = useState(false)

  // Função para limpar estado de autenticação
  const clearAuthState = () => {
    setUser(null)
    setUserProfile(null)
  }

  // Função para verificar se o erro é relacionado a token inválido
  const isTokenError = (error: unknown): boolean => {
    if (!error) return false
    
    const message = (error as { message?: string; status?: number }).message?.toLowerCase() || ''
    return (
      message.includes('refresh token') ||
      message.includes('invalid token') ||
      message.includes('jwt') ||
      message.includes('session') ||
      (error as { status?: number }).status === 401 ||
      (error as { status?: number }).status === 403
    )
  }

  // Função para limpar tokens inválidos do localStorage
  const clearInvalidTokens = () => {
    try {
      // Remove tokens do Supabase do localStorage
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.warn('Error clearing tokens:', error)
    }
  }

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId)

      // Primeiro, testa se a tabela users existe com timeout
      const testPromise = supabase
        .from('users')
        .select('count')
        .limit(1)
      
      const testTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Table test timeout')), 10000)
      )
      
      const { error: testError } = await Promise.race([testPromise, testTimeoutPromise]) as any

      if (testError) {
        console.warn('Users table not accessible:', testError.message)
        console.log('Creating user profile in auth.users instead...')
        
        // Se a tabela users não existe, usa apenas os dados do auth
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const basicProfile: UserProfile = {
            id: user.id,
            email: user.email || '',
            role: 'user',
            currency: 'BRL',
            company_name: 'Prizely',
            created_at: user.created_at,
            updated_at: user.updated_at || user.created_at
          }
          console.log('Using basic profile from auth:', basicProfile)
          setUserProfile(basicProfile)
        }
        return
      }

      // Busca o perfil do usuário com timeout (sem .single() para evitar erro se não existir)
      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
      
      const profileTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 12000)
      )
      
      const { data: profiles, error } = await Promise.race([profilePromise, profileTimeoutPromise]) as any

      if (error) {
        console.error(' Error fetching user profile:', error)
        
        // Se é erro de token, limpar estado
        if (isTokenError(error)) {
          console.warn(' Token error in profile fetch, clearing auth state')
          clearInvalidTokens()
          clearAuthState()
        } else {
          // Se é outro erro, usar perfil básico do auth
          console.log(' Falling back to basic profile from auth...')
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const basicProfile: UserProfile = {
              id: user.id,
              email: user.email || '',
              role: 'user',
              currency: 'BRL',
              company_name: 'Prizely',
              created_at: user.created_at,
              updated_at: user.updated_at || user.created_at
            }
            console.log('Using basic profile from auth:', basicProfile)
            setUserProfile(basicProfile)
          }
        }
        return
      }

      // Se encontrou perfil na tabela users, usar ele
      if (profiles && profiles.length > 0) {
        console.log(' Profile found in users table:', profiles[0])
        setUserProfile(profiles[0])
      } else {
        // Se não encontrou na tabela users, usar perfil básico do auth
        console.log(' No profile in users table, using basic profile from auth...')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const basicProfile: UserProfile = {
            id: user.id,
            email: user.email || '',
            role: 'user',
            currency: 'BRL',
            company_name: 'Prizely',
            created_at: user.created_at,
            updated_at: user.updated_at || user.created_at
          }
          console.log('Using basic profile from auth:', basicProfile)
          setUserProfile(basicProfile)
        }
      }
    } catch (error) {
      console.error(' Unexpected error fetching user profile:', error)
      
      if (isTokenError(error)) {
        console.warn(' Token error in profile fetch, clearing auth state')
        clearInvalidTokens()
        clearAuthState()
      } else {
        // Fallback para perfil básico
        console.log(' Fallback to basic profile due to error...')
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const basicProfile: UserProfile = {
              id: user.id,
              email: user.email || '',
              role: 'user',
              currency: 'BRL',
              company_name: 'Prizely',
              created_at: user.created_at,
              updated_at: user.updated_at || user.created_at
            }
            console.log('Using basic profile from auth:', basicProfile)
            setUserProfile(basicProfile)
          }
        } catch (fallbackError) {
          console.error(' Even fallback failed:', fallbackError)
        }
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Função para testar conectividade com Supabase com retry inteligente
    const testSupabaseConnection = async (retries = 3): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          console.log(` Testing Supabase connection... (attempt ${i + 1}/${retries})`)
          
          // Cria cliente com timeout progressivo: 15s, 20s, 25s
          const timeoutMs = 15000 + (i * 5000)
          const testClient = createSupabaseClient(timeoutMs)
          
          // Teste mais simples que não depende de políticas RLS
          const { error } = await testClient.auth.getUser()
          
          if (!error) {
            console.log(' Supabase connection successful')
            return true
          }
          
          // Se é erro de token inválido, não tentar novamente
          if (isTokenError(error)) {
            console.warn(' Invalid token detected, clearing auth state')
            clearInvalidTokens()
            clearAuthState()
            return false
          }
          
          console.warn(` Connection test failed (attempt ${i + 1}):`, error.message)
          
          // Aguarda antes da próxima tentativa (exponential backoff)
          if (i < retries - 1) {
            const delayMs = Math.pow(2, i) * 2000 // 2s, 4s, 8s
            console.log(` Waiting ${delayMs}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
        } catch (err) {
          console.error(` Supabase connection test failed (attempt ${i + 1}):`, err)
          
          // Se é timeout, não é erro de token
          if (err instanceof Error && err.message.includes('timeout')) {
            console.warn(` Timeout on attempt ${i + 1}, will retry with longer timeout`)
          }
          
          if (i < retries - 1) {
            const delayMs = Math.pow(2, i) * 2000
            console.log(` Waiting ${delayMs}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
        }
      }
      
      console.error(' All connection tests failed')
      return false
    }

    // Get initial session com retry e fallback
    const getInitialSession = async () => {
      try {
        console.log(' Starting auth session check...')
        
        // Timeout de 30 segundos para usuários de outros países
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn(' Session fetch timeout - showing connection fallback')
            setShowConnectionFallback(true)
            setLoading(false)
          }
        }, 30000)

        console.log(' Fetching session from Supabase...')
        console.log(' Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log(' Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        
        // Teste de conectividade primeiro
        const isConnected = await testSupabaseConnection()
        if (!isConnected) {
          console.warn(' Supabase connection failed, showing connection fallback')
          if (mounted) {
            clearTimeout(timeoutId)
            setShowConnectionFallback(true)
            setLoading(false)
          }
          return
        }

        console.log(' Supabase connection OK, fetching session...')
        
        // Promise com timeout individual para getSession (15s para usuários globais)
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 15000)
        )
        
        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: { user?: any, expires_at?: number } | null }, error: Error | null }
        
        console.log(' Session data:', { 
          hasSession: !!data.session, 
          hasUser: !!data.session?.user,
          error: error?.message 
        })

        // Se há erro de token, limpar estado
        if (error && isTokenError(error)) {
          console.warn(' Invalid session token detected:', error.message)
          clearInvalidTokens()
          clearAuthState()
          return
        }

        if (error) {
          console.error(' Error fetching auth session:', error)
          clearAuthState()
          return
        }

        const session = data.session
        
        // Verificar se a sessão é válida
        if (session?.user && session.expires_at) {
          const now = Math.floor(Date.now() / 1000)
          const expiresAt = session.expires_at
          console.log(' Session expires at:', new Date(expiresAt * 1000).toISOString())
          console.log(' Current time:', new Date(now * 1000).toISOString())
          
          if (expiresAt < now) {
            console.warn(' Session expired, clearing auth state')
            clearInvalidTokens()
            clearAuthState()
            return
          }
        }

        if (mounted) {
          console.log(' Setting user in context:', session?.user?.id)
          setUser(session?.user ?? null)

          if (session?.user) {
            console.log("Fetching user profile for:", session.user.id)
            await fetchUserProfile(session.user.id)
          }
        }
      } catch (error) {
        console.error(' Unexpected error while getting session:', error)
        if (mounted) {
          clearAuthState()
        }
      } finally {
        if (mounted) {
          clearTimeout(timeoutId)
          setLoading(false)
          console.log(' Auth session check completed')
        }
      }
    }

    getInitialSession()

    // Listen for auth changes com tratamento de erro melhorado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        try {
          // Se é um evento de erro ou token inválido, limpar estado
          if (event === 'TOKEN_REFRESHED' && !session) {
            console.warn('Token refresh failed - clearing auth state')
            clearInvalidTokens()
            clearAuthState()
            return
          }

          // Se é um evento de sign out, limpar estado
          if (event === 'SIGNED_OUT') {
            clearAuthState()
            return
          }

          setUser(session?.user ?? null)

          if (session?.user) {
            await fetchUserProfile(session.user.id)
          } else {
            setUserProfile(null)
          }
        } catch (error) {
          console.error('Unexpected error during auth state change:', error)
          if (mounted && isTokenError(error)) {
            clearInvalidTokens()
            clearAuthState()
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [fetchUserProfile])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error && isTokenError(error)) {
        clearInvalidTokens()
        clearAuthState()
      }
      
      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: error instanceof Error ? error : new Error('Erro inesperado no login') }
    }
  }

  const signUp = async (email: string, password: string, companyName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            company_name: companyName,
          },
        },
      })
      
      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { error: error instanceof Error ? error : new Error('Erro inesperado no cadastro') }
    }
  }

  const signOut = async () => {
    try {
      clearInvalidTokens()
      await supabase.auth.signOut()
      clearAuthState()
    } catch (error) {
      console.error('Sign out error:', error)
      // Mesmo com erro, limpar estado local
      clearAuthState()
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') }

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (error && isTokenError(error)) {
        clearInvalidTokens()
        clearAuthState()
        return { error: new Error('Sessão expirada. Faça login novamente.') }
      }

      if (!error) {
        setUserProfile(prev => prev ? { ...prev, ...updates } : null)
      }

      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      console.error('Update profile error:', error)
      return { error: error instanceof Error ? error : new Error('Erro inesperado ao atualizar perfil') }
    }
  }

  const retryConnection = () => {
    setShowConnectionFallback(false)
    setLoading(true)
    // Recarrega a página para tentar novamente
    window.location.reload()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        showConnectionFallback,
        signIn,
        signUp,
        signOut,
        updateProfile,
        retryConnection,
      }}
    >
      {children}
      <ConnectionFallback 
        isVisible={showConnectionFallback} 
        onRetry={retryConnection} 
      />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}