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
      console.log('👤 Buscando perfil do usuário:', userId)

      // Primeiro, obter dados básicos do auth (sempre funciona)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('⚠️ Usuário não encontrado no auth')
        return
      }

      // Verificar se é admin via user_metadata
      const isAdmin = user.user_metadata?.role === 'admin'
      
      const basicProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        role: isAdmin ? 'admin' : 'user',
        currency: 'BRL',
        company_name: user.user_metadata?.company_name || 'Empresa',
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at
      }
      console.log('✅ Perfil básico definido a partir do auth:', basicProfile)
      setUserProfile(basicProfile)

      // Tentar buscar perfil da tabela users em background (sem bloquear)
      setTimeout(async () => {
        try {
          console.log('🔄 Tentando buscar perfil da tabela users em background...')
          
          const { data: userProfileData, error: profileError } = await supabase
            .from('users')
            .select('id, email, company_name, role, currency, created_at, updated_at')
            .eq('id', userId)
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
            console.log('✅ Perfil completo obtido da tabela users:', fullProfile)
            setUserProfile(fullProfile)
          } else {
            console.warn('⚠️ Perfil não encontrado na tabela users:', profileError)
          }
        } catch (bgError) {
          console.warn('⚠️ Erro ao buscar perfil em background:', bgError)
        }
      }, 100) // Muito rápido para não bloquear
      
    } catch (error) {
      console.error('❌ Erro ao buscar perfil do usuário:', error)
      // Em caso de erro, usar perfil padrão
      const defaultProfile: UserProfile = {
        id: userId,
        email: '',
        role: 'user',
        currency: 'BRL',
        company_name: 'Empresa',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setUserProfile(defaultProfile)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    
    // Carregamento simplificado - sem verificações complexas
    const getInitialSession = async () => {
      try {
        console.log('🚀 Carregamento simplificado iniciado...')
        
        // Timeout muito reduzido - apenas 1.5 segundos
        const timeoutId = setTimeout(() => {
          if (mounted) {
            console.log('⏰ Timeout de 1.5s atingido - liberando UI')
            setLoading(false)
          }
        }, 1500)

        // Busca sessão simples sem verificações complexas
        const { data } = await supabase.auth.getSession()
        
        clearTimeout(timeoutId)
        
        console.log('📡 Sessão obtida:', { hasSession: !!data.session, hasUser: !!data.session?.user })
        
        if (mounted) {
          const session = data.session
          console.log('👤 Definindo usuário no contexto:', session?.user?.id)
          setUser(session?.user ?? null)

          if (session?.user) {
            console.log("📋 Buscando perfil do usuário:", session.user.id)
            // Busca perfil em paralelo para não bloquear a UI
            fetchUserProfile(session.user.id).catch(error => {
              console.warn('⚠️ Erro ao buscar perfil (não crítico):', error)
            })
          }
        }
      } catch (error) {
        console.error('❌ Erro ao obter sessão:', error)
        if (mounted) {
          clearAuthState()
        }
      } finally {
        if (mounted) {
          setLoading(false)
          console.log('✅ Carregamento simplificado concluído')
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