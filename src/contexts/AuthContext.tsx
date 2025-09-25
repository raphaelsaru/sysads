'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, clearSupabaseInstance } from '@/lib/supabase'
import ConnectionFallback from '@/components/auth/ConnectionFallback'
import { useConnectionHealth } from '@/hooks/useConnectionHealth'

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
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, companyName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>
  retryConnection: () => void
  skipConnectionCheck: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConnectionFallback, setShowConnectionFallback] = useState(false)
  
  // Hook para monitorar saúde da conexão
  const connectionHealth = useConnectionHealth()
  
  // Monitora mudanças na saúde da conexão para esconder o popup quando necessário
  useEffect(() => {
    if (connectionHealth.isHealthy && showConnectionFallback) {
      console.log('✅ Conexão restaurada, escondendo popup')
      setShowConnectionFallback(false)
    }
  }, [connectionHealth.isHealthy, showConnectionFallback])

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
      
      // Limpa a instância do Supabase para forçar recriação
      clearSupabaseInstance()
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
      
      const { error: testError } = await Promise.race([testPromise, testTimeoutPromise]) as { error: Error | null }

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
      
      const { data: profiles, error } = await Promise.race([profilePromise, profileTimeoutPromise]) as { data: UserProfile[] | null, error: Error | null }

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
    // Fallback de segurança para garantir que o loading nunca fique travado
    const fallbackTimeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('🚨 Fallback de segurança ativado - forçando fim do loading')
        setLoading(false)
        setShowConnectionFallback(true)
      }
    }, 20000) // 20 segundos como último recurso

    // Get initial session com retry e fallback
    const getInitialSession = async () => {
      try {
        console.log(' Starting auth session check...')
        
        // Timeout de 15 segundos para evitar espera muito longa
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn(' Session fetch timeout - showing connection fallback')
            setShowConnectionFallback(true)
            setLoading(false)
          }
        }, 15000)

        console.log(' Fetching session from Supabase...')
        console.log(' Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log(' Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        
        // Verificação simples de conectividade (sem usar o hook complexo)
        try {
          console.log('🔍 Verificando conectividade básica...')
          const testPromise = supabase.auth.getUser()
          const testTimeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Connection test timeout')), 3000)
          )
          
          await Promise.race([testPromise, testTimeoutPromise])
          console.log('✅ Conectividade básica OK')
        } catch (error) {
          console.warn('⚠️ Problema na conectividade, mas continuando...', error)
          // Continua mesmo com problema de conectividade
        }

        console.log(' Supabase connection OK, fetching session...')
        
        // Promise com timeout individual para getSession (10s para usuários globais)
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 10000)
        )
        
        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: { user?: User, expires_at?: number } | null }, error: Error | null }
        
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
          clearTimeout(fallbackTimeoutId)
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
      clearTimeout(fallbackTimeoutId)
      subscription.unsubscribe()
    }
  }, [fetchUserProfile, loading])

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      console.log('🔐 Fazendo login com rememberMe:', rememberMe)
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error && isTokenError(error)) {
        clearInvalidTokens()
        clearAuthState()
      }
      
      // Se o login foi bem-sucedido e rememberMe está marcado, salvar preferência
      if (!error && rememberMe) {
        console.log('💾 Salvando preferência de lembrar-me')
        localStorage.setItem('prizely_remember_me', 'true')
        localStorage.setItem('prizely_user_email', email)
      } else if (!error && !rememberMe) {
        // Se não marcou lembrar-me, limpar preferências salvas
        console.log('🗑️ Limpando preferências de lembrar-me')
        localStorage.removeItem('prizely_remember_me')
        localStorage.removeItem('prizely_user_email')
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
      console.log('🚪 Fazendo logout e limpando preferências')
      clearInvalidTokens()
      await supabase.auth.signOut()
      clearAuthState()
      
      // Limpar preferências de lembrar-me ao fazer logout manual
      localStorage.removeItem('prizely_remember_me')
      localStorage.removeItem('prizely_user_email')
    } catch (error) {
      console.error('Sign out error:', error)
      // Mesmo com erro, limpar estado local
      clearAuthState()
      localStorage.removeItem('prizely_remember_me')
      localStorage.removeItem('prizely_user_email')
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
    
    // Usa o hook de saúde da conexão para resetar
    connectionHealth.resetConnection()
    
    // Aguarda um pouco antes de recarregar para dar tempo da limpeza
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  const skipConnectionCheck = () => {
    console.log('⏭️ Pulando verificação de conexão')
    setShowConnectionFallback(false)
    setLoading(false)
    // Continua com a aplicação mesmo sem verificação de conexão
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
        skipConnectionCheck,
      }}
    >
      {children}
      <ConnectionFallback 
        isVisible={showConnectionFallback} 
        onRetry={retryConnection}
        onSkip={skipConnectionCheck}
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