'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, companyName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Get initial session com timeout
    const getInitialSession = async () => {
      try {
        // Timeout de 10 segundos para evitar loading infinito
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('Session fetch timeout - clearing auth state')
            clearAuthState()
            setLoading(false)
          }
        }, 10000)

        const { data, error } = await supabase.auth.getSession()

        // Se há erro de token, limpar estado
        if (error && isTokenError(error)) {
          console.warn('Invalid session token detected:', error.message)
          clearInvalidTokens()
          clearAuthState()
          return
        }

        if (error) {
          console.error('Error fetching auth session:', error)
          clearAuthState()
          return
        }

        const session = data.session
        
        // Verificar se a sessão é válida
        if (session?.user && session.expires_at) {
          const now = Math.floor(Date.now() / 1000)
          if (session.expires_at < now) {
            console.warn('Session expired, clearing auth state')
            clearInvalidTokens()
            clearAuthState()
            return
          }
        }

        if (mounted) {
          setUser(session?.user ?? null)

          if (session?.user) {
            await fetchUserProfile(session.user.id)
          }
        }
      } catch (error) {
        console.error('Unexpected error while getting session:', error)
        if (mounted) {
          clearAuthState()
        }
      } finally {
        if (mounted) {
          clearTimeout(timeoutId)
          setLoading(false)
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
  }, [])

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId)

      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        
        // Se é erro de token, limpar estado
        if (isTokenError(error)) {
          clearInvalidTokens()
          clearAuthState()
        }
        return
      }

      console.log('Profile fetch result:', profile)
      setUserProfile(profile)
    } catch (error) {
      console.error('Error fetching user profile:', error)
      
      if (isTokenError(error)) {
        clearInvalidTokens()
        clearAuthState()
      }
    }
  }, [])

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

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
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