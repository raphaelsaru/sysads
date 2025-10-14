'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

interface UseSessionPersistenceOptions {
  onSessionExpired?: () => void
  onSessionRefreshed?: () => void
  refreshThreshold?: number // minutos antes da expiração para tentar refresh
}

export function useSessionPersistence({
  onSessionExpired,
  onSessionRefreshed,
  refreshThreshold = 5 // 5 minutos por padrão
}: UseSessionPersistenceOptions = {}) {

  // Função para verificar e renovar sessão se necessário
  const checkAndRefreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        console.warn('⚠️ Nenhuma sessão válida encontrada')
        // Tentar uma última vez recuperar a sessão
        console.log('🔄 Tentando recuperar sessão...')
        const { data: { session: recoveredSession } } = await supabase.auth.refreshSession()
        
        if (recoveredSession) {
          console.log('✅ Sessão recuperada com sucesso!')
          onSessionRefreshed?.()
          return true
        }
        
        onSessionExpired?.()
        return false
      }

      const now = Math.floor(Date.now() / 1000)
      const expiresAt = session.expires_at || 0
      const thresholdSeconds = refreshThreshold * 60

      // Se a sessão expira em menos tempo que o threshold, tentar renovar
      if (expiresAt - now < thresholdSeconds) {
        console.log('⏰ Sessão expirando em breve, tentando renovar...')

        const { error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError) {
          console.error('❌ Falha ao renovar sessão:', refreshError.message)

          // Se já expirou, chamar callback
          if (expiresAt < now) {
            console.log('⚠️ Sessão expirada')
            onSessionExpired?.()
            return false
          }
        } else {
          console.log('✅ Sessão renovada com sucesso!')
          onSessionRefreshed?.()
          return true
        }
      }

      return true
    } catch (error) {
      console.error('❌ Erro ao verificar sessão:', error)
      return false
    }
  }, [refreshThreshold, onSessionExpired, onSessionRefreshed])

  // Verifica sessão a cada 2 minutos
  useEffect(() => {
    // Verificação inicial
    checkAndRefreshSession()

    // Configurar intervalo para verificação periódica
    const interval = setInterval(checkAndRefreshSession, 2 * 60 * 1000) // 2 minutos

    return () => clearInterval(interval)
  }, [checkAndRefreshSession])

  // Verificar sessão quando a página volta ao foco
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, checking session...')
      checkAndRefreshSession()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, checking session...')
        checkAndRefreshSession()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkAndRefreshSession])

  return {
    checkAndRefreshSession,
  }
}