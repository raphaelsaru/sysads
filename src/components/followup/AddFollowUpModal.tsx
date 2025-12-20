'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { NovoFollowUp, FollowUp } from '@/types/crm'
import { useFollowUps } from '@/hooks/useFollowUps'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddFollowUpModalProps {
  isOpen: boolean
  onClose: () => void
  clienteId: string
  clienteNome: string
  onSuccess?: (followUp: FollowUp) => void
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
  const { criarFollowUp, editarFollowUp, buscarFollowUps, followUps } = useFollowUps()
  const [observacao, setObservacao] = useState('')
  const [respondeu, setRespondeu] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isEditMode = !!followUpParaEditar

  // Calcular o próximo número de follow-up (apenas para modo adicionar)
  const proximoNumero = followUps.length > 0 
    ? Math.max(...followUps.map(fu => fu.numeroFollowup)) + 1
    : 1

  // Carregar follow-ups quando o modal abrir para calcular o número
  useEffect(() => {
    if (isOpen && clienteId) {
      buscarFollowUps(clienteId)
    }
  }, [isOpen, clienteId, buscarFollowUps])

  // Preencher formulário quando estiver em modo edição
  useEffect(() => {
    if (isOpen && followUpParaEditar) {
      setObservacao(followUpParaEditar.observacao)
      setRespondeu(followUpParaEditar.respondeu)
    } else if (!isOpen) {
      setObservacao('')
      setRespondeu(false)
    }
  }, [isOpen, followUpParaEditar])

  // Focar no textarea quando abrir
  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!observacao.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      let followUp: FollowUp

      if (isEditMode && followUpParaEditar) {
        // Modo edição
        followUp = await editarFollowUp(followUpParaEditar.id, {
          observacao: observacao.trim(),
          respondeu,
        })
      } else {
        // Modo criação
        const novoFollowUp: NovoFollowUp = {
          clienteId,
          observacao: observacao.trim(),
          respondeu,
        }
        followUp = await criarFollowUp(novoFollowUp)
      }
      
      // Chamar callback de sucesso
      if (onSuccess) {
        onSuccess(followUp)
      }

      // Fechar modal e limpar formulário
      setObservacao('')
      setRespondeu(false)
      onClose()
    } catch (error) {
      console.error(`Erro ao ${isEditMode ? 'editar' : 'criar'} follow-up:`, error)
      // O erro já é tratado pelo hook, mas podemos mostrar uma mensagem aqui se necessário
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setObservacao('')
      setRespondeu(false)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            {isEditMode ? 'Editar Follow-up' : 'Adicionar Follow-up'}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {isEditMode ? (
              <>Edite o follow-up para <span className="font-semibold text-foreground">{clienteNome}</span>.</>
            ) : (
              <>Registre um novo follow-up para <span className="font-semibold text-foreground">{clienteNome}</span>.
              Este será o <span className="font-semibold text-primary">Follow-up #{proximoNumero}</span>.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação *</Label>
            <Textarea
              ref={textareaRef}
              id="observacao"
              name="observacao"
              rows={5}
              placeholder="Descreva o que aconteceu neste follow-up..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              required
              disabled={isSubmitting}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Ex: &quot;Reativei o cliente que tinha parado de responder&quot; ou &quot;Cliente mostrou interesse e está chamando pela terceira vez&quot;
            </p>
          </div>

          <div className="space-y-2">
            <Label>Status da resposta</Label>
            <div className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3",
              respondeu 
                ? "border-success/50 bg-success/5" 
                : "border-border/70 bg-muted/40"
            )}>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Cliente respondeu?
                </p>
                <p className="text-xs text-muted-foreground">
                  Marque se o cliente respondeu a este follow-up
                </p>
              </div>
              <Switch
                checked={respondeu}
                onCheckedChange={setRespondeu}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !observacao.trim()}
              className={cn('gap-2', isSubmitting && 'cursor-progress')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                isEditMode ? 'Salvar alterações' : `Salvar Follow-up #${proximoNumero}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

