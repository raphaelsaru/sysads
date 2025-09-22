'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useAuthHealth() {
  const [isHealthy, setIsHealthy] = useState(true)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkAuthHealth = async () => {
    try {
      // Tentar uma operação simples para verificar se a conexão está ok
      const { error } = await supabase.auth.getSession()
      
      if (error) {
        console.warn('Auth health check failed:', error)
        setIsHealthy(false)
      } else {
        setIsHealthy(true)
      }
    } catch (error) {
      console.warn('Auth health check error:', error)
      setIsHealthy(false)
    } finally {
      setLastCheck(new Date())
    }
  }

  useEffect(() => {
    // Verificar saúde da auth a cada 30 segundos
    const interval = setInterval(checkAuthHealth, 30000)
    
    // Verificar imediatamente
    checkAuthHealth()

    return () => clearInterval(interval)
  }, [])

  return {
    isHealthy,
    lastCheck,
    checkAuthHealth
  }
}
