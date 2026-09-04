'use client'

import { useState } from 'react'

import { formatDateISO } from '@/lib/dateUtils'
import { Negociacao, NovaNegociacao } from '@/types/crm'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FALLBACK_CURRENCY_VALUE, type SupportedCurrency } from '@/lib/currency'
import { useNegociacaoFormState } from '@/hooks/useNegociacaoFormState'
import NegociacaoFormFields from './NegociacaoFormFields'

export interface NegociacaoFormProps {
  clienteId: string
  negociacao?: Negociacao
  onSave: (data: NovaNegociacao | Partial<NovaNegociacao>) => void | Promise<void>
  onCancel: () => void
  currency?: SupportedCurrency
}

export default function NegociacaoForm({
  clienteId,
  negociacao,
  onSave,
  onCancel,
  currency = FALLBACK_CURRENCY_VALUE,
}: NegociacaoFormProps) {
  const negociacaoFormState = useNegociacaoFormState(clienteId, negociacao, currency)
  const { formData } = negociacaoFormState
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: NovaNegociacao = {
        ...formData,
        dataContato: formatDateISO(formData.dataContato),
      }

      await onSave(payload)
    } catch (error) {
      console.error('Erro ao salvar negociação:', error)
      alert('Erro ao salvar negociação. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <NegociacaoFormFields {...negociacaoFormState} currency={currency} />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className={cn('gap-2', isSubmitting && 'cursor-progress')}>
          {isSubmitting ? 'Salvando...' : negociacao ? 'Atualizar negociação' : 'Salvar negociação'}
        </Button>
      </div>
    </form>
  )
}
