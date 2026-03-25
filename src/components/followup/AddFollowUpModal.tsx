'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FollowUp } from '@/types/crm'
import { useFollowUps } from '@/hooks/useFollowUps'
import { Loader2 } from 'lucide-react'

interface AddFollowUpModalProps {
  isOpen: boolean
  onClose: () => void
  clienteId: string
  clienteNome: string
  onSuccess: (followUp: FollowUp) => void
  followUpParaEditar?: FollowUp | null
}

export default function AddFollowUpModal({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  onSuccess,
  followUpParaEditar,
}: AddFollowUpModalProps) {
  const { criarFollowUp, editarFollowUp } = useFollowUps()
  const [observacao, setObservacao] = useState('')
  const [respondeu, setRespondeu] = useState(false)
  const [loading, setLoading] = useState(false)

  const isEditing = !!followUpParaEditar

  useEffect(() => {
    if (followUpParaEditar) {
      setObservacao(followUpParaEditar.observacao)
      setRespondeu(followUpParaEditar.respondeu)
    } else {
      setObservacao('')
      setRespondeu(false)
    }
  }, [followUpParaEditar, isOpen])

  const handleSubmit = async () => {
    if (!observacao.trim()) return

    setLoading(true)
    try {
      let result: FollowUp
      if (isEditing && followUpParaEditar) {
        result = await editarFollowUp(followUpParaEditar.id, { observacao, respondeu })
      } else {
        result = await criarFollowUp({ clienteId, observacao, respondeu })
      }
      onSuccess(result)
      onClose()
    } catch (error) {
      console.error('Erro ao salvar follow-up:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Follow-up' : 'Novo Follow-up'}
          </DialogTitle>
          <DialogDescription>
            {clienteNome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Descreva o follow-up..."
              rows={4}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="respondeu"
              checked={respondeu}
              onCheckedChange={setRespondeu}
            />
            <Label htmlFor="respondeu">Cliente respondeu</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !observacao.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
