'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-browser'
import ConnectionFallback from '@/components/auth/ConnectionFallback'
import { useConnectionHealth } from '@/hooks/useConnectionHealth'

const supabase = createClient()

import { UserProfile as UserProfileType, UserRole, TenantBranding } from '@/types/crm'

export interface UserProfile extends UserProfileType {
  email: string
  tenant?: {
    id: string
    name: string
    branding: TenantBranding
  } | null
}

type ProfileRow = {
  id: string
  tenant_id: string | null
  role: UserRole
  full_name: string | null
  company_name: string | null
  currency: 'BRL' | 'USD' | 'EUR' | null
  avatar_url: string | null
  phone: string | null
  preferences: Record<string, unknown> | null
  created_at: string
  updated_at: string
  last_seen_at: string | null
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

      // Buscar perfil do user_profiles
      const { data: profileDataRaw, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          tenant_id,
          role,
          full_name,
          company_name,
          currency,
          avatar_url,
          phone,
          preferences,
          created_at,
          updated_at,
          last_seen_at
        `)
        .eq('id', supabaseUser.id)
        .single()
      
      const profileData = profileDataRaw as ProfileRow | null

      if (profileError) {
        console.error('❌ Erro ao buscar user_profile:', profileError)
        // Criar perfil básico se não existir
        const basicProfile: UserProfile = {
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          tenant_id: null,
          role: 'tenant_user',
          full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email || '',
          company_name: supabaseUser.user_metadata?.company_name || null,
          currency: (supabaseUser.user_metadata?.currency as 'BRL' | 'USD' | 'EUR' | null | undefined) ?? null,
          avatar_url: null,
          phone: null,
          preferences: {},
          created_at: supabaseUser.created_at,
          updated_at: supabaseUser.created_at,
          tenant: null
        }
        setUserProfile(basicProfile)
        return
      }

      if (!profileData) {
        console.warn('ℹ️ Perfil não encontrado, usando dados básicos')
        const basicProfile: UserProfile = {
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          tenant_id: null,
          role: 'tenant_user',
          full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email || '',
          company_name: supabaseUser.user_metadata?.company_name || null,
          currency: (supabaseUser.user_metadata?.currency as 'BRL' | 'USD' | 'EUR' | null | undefined) ?? null,
          avatar_url: null,
          phone: null,
          preferences: {},
          created_at: supabaseUser.created_at,
          updated_at: supabaseUser.created_at,
          tenant: null
        }
        setUserProfile(basicProfile)
        return
      }

      // Se tem tenant_id, buscar dados do tenant
      let tenantData = null
      if (profileData.tenant_id) {
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, branding')
          .eq('id', profileData.tenant_id)
          .single()

        if (!tenantError && tenant) {
          tenantData = tenant
        }
      }

      const fullProfile: UserProfile = {
        id: profileData.id,
        email: supabaseUser.email || '',
        tenant_id: profileData.tenant_id,
        role: profileData.role,
        full_name: profileData.full_name,
        company_name: profileData.company_name,
        currency: profileData.currency,
        avatar_url: profileData.avatar_url,
        phone: profileData.phone,
        preferences: profileData.preferences || {},
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
        last_seen_at: profileData.last_seen_at,
        tenant: tenantData
      }

      setUserProfile(fullProfile)
      console.log('✅ Perfil carregado:', fullProfile.role, fullProfile.tenant_id ? `(Tenant: ${fullProfile.tenant?.name})` : '')
      
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
            setLoading(false)
            void fetchUserProfile(data.session.user)
          } else {
            console.log('ℹ️ Nenhuma sessão encontrada')
            setUser(null)
            setUserProfile(null)
            setLoading(false)
          }
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
          setLoading(false)
          void fetchUserProfile(session.user)
        } else {
          setUserProfile(null)
          setLoading(false)
        }
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
      // Não permitir atualização de campos sensíveis
      const safeUpdates: Partial<UserProfile> = { ...updates }
      delete safeUpdates.email
      delete safeUpdates.tenant
      delete safeUpdates.tenant_id
      delete safeUpdates.role

      const updatesPayload = safeUpdates as Partial<ProfileRow>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userProfilesTable = supabase.from('user_profiles') as any
      const { error } = await userProfilesTable
        .update(updatesPayload)
        .eq('id', user.id)

      if (!error) {
        setUserProfile(prev => prev ? { ...prev, ...safeUpdates } : null)
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
