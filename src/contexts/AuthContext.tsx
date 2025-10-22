'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-browser'
import ConnectionFallback from '@/components/auth/ConnectionFallback'
import { useConnectionHealth } from '@/hooks/useConnectionHealth'

const supabase = createClient()

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

  const fetchUserProfile = useCallback(async (supabaseUser: User) => {
    try {
      console.log('👤 Buscando perfil do usuário:', supabaseUser.id)

      const isAdmin = supabaseUser.user_metadata?.role === 'admin'
      
      const basicProfile: UserProfile = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        role: isAdmin ? 'admin' : 'user',
        currency: 'BRL',
        company_name: supabaseUser.user_metadata?.company_name || 'Empresa',
        created_at: supabaseUser.created_at,
        updated_at: supabaseUser.updated_at || supabaseUser.created_at
      }
      
      setUserProfile(basicProfile)

      // Tentar buscar perfil completo da tabela users
      const { data: userProfileData, error: profileError } = await supabase
        .from('users')
        .select('id, email, company_name, role, currency, created_at, updated_at')
        .eq('id', supabaseUser.id)
        .single()

      if (!profileError && userProfileData) {
        const fullProfile: UserProfile = {
          id: userProfileData.id,
          email: userProfileData.email,
          role: userProfileData.role || 'user',
          currency: userProfileData.currency || 'BRL',
          company_name: userProfileData.company_name || 'Empresa',
          created_at: userProfileData.created_at,
          updated_at: userProfileData.updated_at || userProfileData.created_at
        }
        setUserProfile(fullProfile)
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar perfil do usuário:', error)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    
    const getInitialSession = async () => {
      try {
        console.log('🚀 Verificando sessão...')
        
        const { data } = await supabase.auth.getSession()
        
        if (mounted) {
          if (data.session?.user) {
            console.log('✅ Sessão encontrada')
            setUser(data.session.user)
            await fetchUserProfile(data.session.user)
          } else {
            console.log('ℹ️ Nenhuma sessão encontrada')
            setUser(null)
            setUserProfile(null)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('❌ Erro ao obter sessão:', error)
        if (mounted) {
          setUser(null)
          setUserProfile(null)
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('Auth event:', event)
        
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchUserProfile(session.user)
        } else {
          setUserProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchUserProfile])

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Fazendo login...')
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      console.error('Erro no login:', error)
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
      console.log('🚪 Fazendo logout...')
      await supabase.auth.signOut()
      setUser(null)
      setUserProfile(null)
    } catch (error) {
      console.error('Erro no logout:', error)
      setUser(null)
      setUserProfile(null)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('Nenhum usuário logado') }

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (!error) {
        setUserProfile(prev => prev ? { ...prev, ...updates } : null)
      }

      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
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
