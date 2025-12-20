'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FollowUp } from '@/types/crm'
import { useFollowUps } from '@/hooks/useFollowUps'
import { Loader2, CheckCircle2, XCircle, MessageSquare, Pencil } from 'lucide-react'
import { formatDateBR } from '@/lib/dateUtils'
import { Card, CardContent } from '@/components/ui/card'

interface FollowUpHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  clienteId: string
  clienteNome: string
  onAddFollowUp?: () => void
  onEditFollowUp?: (followUp: FollowUp) => void
}

export default function FollowUpHistoryModal({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  onAddFollowUp,
  onEditFollowUp,
}: FollowUpHistoryModalProps) {
  const { followUps, loading, buscarFollowUps } = useFollowUps()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && clienteId) {
      setIsLoading(true)
      buscarFollowUps(clienteId).finally(() => {
        setIsLoading(false)
      })
    }
  }, [isOpen, clienteId, buscarFollowUps])

  const handleAddFollowUp = () => {
    onClose()
    if (onAddFollowUp) {
      onAddFollowUp()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Histórico de Follow-ups
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Histórico completo de follow-ups para <span className="font-semibold text-foreground">{clienteNome}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading || loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando histórico...</span>
            </div>
          ) : followUps.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-card/70">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Nenhum follow-up registrado
                </p>
                <p className="text-xs text-muted-foreground text-center mb-4">
                  Comece a documentar os follow-ups com este cliente
                </p>
                <Button onClick={handleAddFollowUp} size="sm">
                  Adicionar primeiro follow-up
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {followUps.map((followUp) => (
                <Card key={followUp.id} className="border-border/60 bg-card/80">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-semibold">
                          Follow-up #{followUp.numeroFollowup}
                        </Badge>
                        {followUp.respondeu ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Respondeu
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Não respondeu
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateBR(followUp.createdAt)}
                        </span>
                        {onEditFollowUp && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEditFollowUp(followUp)}
                            title="Editar follow-up"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {followUp.observacao}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{followUps.length}</span> follow-up{followUps.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handleAddFollowUp}>
              Adicionar Follow-up
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

