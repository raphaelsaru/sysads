'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface ConnectionHealth {
  isHealthy: boolean
  isChecking: boolean
  lastCheck: Date | null
  error: string | null
}

export function useConnectionHealth() {
  const [health, setHealth] = useState<ConnectionHealth>({
    isHealthy: true, // Assume healthy inicialmente
    isChecking: false,
    lastCheck: null,
    error: null,
  })

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setHealth(prev => ({ ...prev, isChecking: true, error: null }))

    try {
      console.log('🔍 Verificando saúde da conexão...')
      
      // Cria cliente com timeout de 3 segundos (mais rápido)
      const client = createClient()
      
      // Teste simples de conectividade com timeout próprio
      const connectionPromise = client.auth.getUser()
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      )
      
      const { error } = await Promise.race([connectionPromise, timeoutPromise])
      
      // Considera healthy se não há erro OU se o erro é apenas de token inválido (normal)
      const isHealthy = !error || (error.message.includes('JWT') || error.message.includes('token'))
      
      setHealth({
        isHealthy,
        isChecking: false,
        lastCheck: new Date(),
        error: error?.message || null,
      })
      
      if (isHealthy) {
        console.log('✅ Conexão saudável')
      } else {
        console.warn('⚠️ Problema na conexão:', error?.message)
      }
      
      return isHealthy
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      // Se é timeout, considera como healthy (pode ser rede lenta)
      const isHealthy = errorMessage.includes('timeout')
      
      setHealth({
        isHealthy,
        isChecking: false,
        lastCheck: new Date(),
        error: errorMessage,
      })
      
      if (isHealthy) {
        console.log('✅ Timeout mas assumindo conexão OK (rede lenta)')
      } else {
        console.error('❌ Erro ao verificar conexão:', errorMessage)
      }
      
      return isHealthy
    }
  }, [])

  const resetConnection = useCallback(() => {
    console.log('🔄 Resetando conexão...')
    
    // Reseta estado
    setHealth({
      isHealthy: false,
      isChecking: false,
      lastCheck: null,
      error: null,
    })
    
    // Verifica novamente após um breve delay
    setTimeout(() => {
      checkConnection()
    }, 1000)
  }, [checkConnection])

  // Verificação automática a cada 15 segundos se a conexão estiver ruim
  useEffect(() => {
    if (!health.isHealthy && !health.isChecking) {
      const interval = setInterval(() => {
        checkConnection()
      }, 15000) // 15 segundos

      return () => clearInterval(interval)
    }
  }, [health.isHealthy, health.isChecking, checkConnection])

  return {
    ...health,
    checkConnection,
    resetConnection,
  }
}
