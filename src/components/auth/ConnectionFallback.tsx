'use client'

import { useState } from 'react'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Conexão Lenta Detectada
          </h3>
          <p className="text-gray-600 mb-4">
            Estamos enfrentando problemas de conectividade. Isso pode ser normal para usuários de outros países.
          </p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mb-4">
              Tentativas: {retryCount}
            </p>
          )}
        </div>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRetrying ? 'Tentando...' : 'Tentar Novamente'}
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Recarregar Página
          </button>
        </div>
        
        <p className="text-xs text-gray-400 mt-4">
          Se o problema persistir, tente novamente em alguns minutos.
        </p>
      </div>
    </div>
  )
}
