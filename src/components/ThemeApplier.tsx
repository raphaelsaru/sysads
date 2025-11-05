'use client'

import { useEffect } from 'react'
import { useTenant } from '@/contexts/TenantContext'

/**
 * Componente que aplica o tema do tenant automaticamente
 * Deve ser montado dentro do TenantProvider
 */
export default function ThemeApplier() {
  const { branding } = useTenant()

  useEffect(() => {
    // O TenantContext já aplica as cores automaticamente
    // Este componente garante que as cores sejam reaplicadas se houver mudanças
    if (branding?.primaryColor && branding?.secondaryColor) {
      console.log('🎨 ThemeApplier: Aplicando cores do tenant')
    }
  }, [branding])

  // Este é um componente "invisível" que apenas aplica efeitos colaterais
  return null
}


