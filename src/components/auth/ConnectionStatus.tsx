'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthHealth } from '@/hooks/useAuthHealth'

export default function ConnectionStatus() {
  const { isHealthy } = useAuthHealth()
  const [showAlert, setShowAlert] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Verificar status online/offline
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Verificar status inicial
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    // Mostrar alerta se há problemas de conectividade
    if (!isOnline || !isHealthy) {
      setShowAlert(true)
    } else {
      // Esconder alerta após 3 segundos se voltou a funcionar
      const timer = setTimeout(() => setShowAlert(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, isHealthy])

  if (!showAlert) return null

  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-sm">
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Sem conexão com a internet. Verifique sua conexão.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isHealthy) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-sm">
        <Alert className="border-warning/40 bg-warning/10 text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Problemas de autenticação detectados. Recarregue a página se necessário.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Alert className="border-success/40 bg-success/10 text-success">
        <Wifi className="h-4 w-4" />
        <AlertDescription>
          Conexão restaurada!
        </AlertDescription>
      </Alert>
    </div>
  )
}
