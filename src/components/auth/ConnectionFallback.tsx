'use client'

import { useState } from 'react'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConnectionFallbackProps {
  onRetry: () => void
  isVisible: boolean
}

export default function ConnectionFallback({ onRetry, isVisible }: ConnectionFallbackProps) {
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    setRetryCount(prev => prev + 1)
    
    // Aguarda um pouco antes de tentar novamente
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    onRetry()
    setIsRetrying(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-soft">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <WifiOff className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">
              Problema de Conectividade
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              Estamos enfrentando problemas de conectividade. Isso pode ser normal para usuários de outros países ou com conexão lenta.
            </CardDescription>
          </div>
          {retryCount > 0 && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
              Tentativas realizadas: {retryCount}
            </div>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              className="gap-2"
              variant="default"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Tentando...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  Tentar Novamente
                </>
              )}
            </Button>
            
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Recarregar Página
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            Se o problema persistir, tente novamente em alguns minutos ou verifique sua conexão com a internet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
