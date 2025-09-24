'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient, clearSupabaseInstance } from '@/lib/supabase'

interface ConnectionHealth {
  isHealthy: boolean
  isChecking: boolean
  lastCheck: Date | null
  error: string | null
}

export function useConnectionHealth() {
  const [health, setHealth] = useState<ConnectionHealth>({
    isHealthy: false,
    isChecking: false,
    lastCheck: null,
    error: null,
  })

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setHealth(prev => ({ ...prev, isChecking: true, error: null }))

    try {
      console.log('🔍 Verificando saúde da conexão...')
      
      // Cria cliente com timeout de 10 segundos
      const client = createSupabaseClient(10000)
      
      // Teste simples de conectividade
      const { error } = await client.auth.getUser()
      
      const isHealthy = !error
      
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
      
      setHealth({
        isHealthy: false,
        isChecking: false,
        lastCheck: new Date(),
        error: errorMessage,
      })
      
      console.error('❌ Erro ao verificar conexão:', errorMessage)
      return false
    }
  }, [])

  const resetConnection = useCallback(() => {
    console.log('🔄 Resetando conexão...')
    
    // Limpa instância do Supabase
    clearSupabaseInstance()
    
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

  // Verificação automática a cada 30 segundos se a conexão estiver ruim
  useEffect(() => {
    if (!health.isHealthy && !health.isChecking) {
      const interval = setInterval(() => {
        checkConnection()
      }, 30000) // 30 segundos

      return () => clearInterval(interval)
    }
  }, [health.isHealthy, health.isChecking, checkConnection])

  return {
    ...health,
    checkConnection,
    resetConnection,
  }
}
