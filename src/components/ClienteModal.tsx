'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { getTodayBR, formatDateISO } from '@/lib/dateUtils'
import { Cliente, NovoCliente } from '@/types/crm'
import { cn } from '@/lib/utils'
import MoneyInput from './MoneyInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FALLBACK_CURRENCY_VALUE, formatCurrency, type SupportedCurrency } from '@/lib/currency'
import { DatePicker } from '@/components/ui/date-picker'
import { Plus, History } from 'lucide-react'
import AddFollowUpModal from '@/components/followup/AddFollowUpModal'
import FollowUpHistoryModal from '@/components/followup/FollowUpHistoryModal'
import { useFollowUps } from '@/hooks/useFollowUps'
import { FollowUp } from '@/types/crm'

interface ClienteModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (cliente: NovoCliente) => void
  cliente?: Cliente
  currency?: SupportedCurrency
}

const ORIGENS: NovoCliente['origem'][] = ['Indicação', 'Orgânico / Perfil', 'Anúncio', 'Cliente antigo']
const RESULTADOS: NovoCliente['resultado'][] = ['Venda', 'Orçamento em Processo', 'Não Venda']
const QUALIDADES: NovoCliente['qualidadeContato'][] = ['Bom', 'Regular', 'Ruim']

export default function ClienteModal({ isOpen, onClose, onSave, cliente, currency = FALLBACK_CURRENCY_VALUE }: ClienteModalProps) {
  const baseState: NovoCliente = useMemo(
    () => ({
      dataContato: getTodayBR(),
      nome: '',
      whatsappInstagram: '',
      origem: 'Orgânico / Perfil',
      orcamentoEnviado: 'Não',
      resultado: 'Orçamento em Processo',
      qualidadeContato: 'Regular',
      naoRespondeu: false,
      valorFechado: '',
      observacao: '',
      pagouSinal: false,
      valorSinal: '',
      dataPagamentoSinal: '',
      vendaPaga: false,
      dataPagamentoVenda: '',
      dataLembreteChamada: '',
    }),
    []
  )

  const [formData, setFormData] = useState<NovoCliente>(baseState)
  const [valorNumerico, setValorNumerico] = useState<number | undefined>()
  const [valorSinalNumerico, setValorSinalNumerico] = useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  
  // Estados para follow-ups
  const [isAddFollowUpOpen, setIsAddFollowUpOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [followUpParaEditar, setFollowUpParaEditar] = useState<FollowUp | null>(null)
  const { buscarFollowUps, followUps } = useFollowUps()
  
  // Carregar follow-ups quando o modal abrir e houver cliente
  useEffect(() => {
    if (isOpen && cliente?.id) {
      buscarFollowUps(cliente.id)
    }
  }, [isOpen, cliente?.id, buscarFollowUps])

  useEffect(() => {
    if (!isOpen) return

    if (cliente) {
      setFormData({
        dataContato: cliente.dataContato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsappInstagram,
        origem: cliente.origem,
        orcamentoEnviado: cliente.orcamentoEnviado,
        resultado: cliente.resultado,
        qualidadeContato: cliente.qualidadeContato,
        naoRespondeu: cliente.naoRespondeu || false,
        valorFechado: cliente.valorFechado || '',
        observacao: cliente.observacao || '',
        pagouSinal: cliente.pagouSinal || false,
        valorSinal: cliente.valorSinal || '',
        dataPagamentoSinal: cliente.dataPagamentoSinal || '',
        vendaPaga: cliente.vendaPaga || false,
        dataPagamentoVenda: cliente.dataPagamentoVenda || '',
        dataLembreteChamada: cliente.dataLembreteChamada || '',
      })
      setValorNumerico(
        cliente.valorFechadoNumero !== null && cliente.valorFechadoNumero !== undefined
          ? cliente.valorFechadoNumero
          : undefined
      )
      setValorSinalNumerico(
        cliente.valorSinalNumero !== null && cliente.valorSinalNumero !== undefined
          ? cliente.valorSinalNumero
          : undefined
      )
    } else {
      setFormData(baseState)
      setValorNumerico(undefined)
      setValorSinalNumerico(undefined)
    }
  }, [cliente, isOpen, baseState])

  useEffect(() => {
    if (!isOpen) return

    const timeout = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 50)

    return () => window.clearTimeout(timeout)
  }, [isOpen])

  const handleChange = (
    field: keyof NovoCliente,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleValorChange = (valor: number | undefined) => {
    setValorNumerico(valor)

    setFormData((prev) => ({
      ...prev,
      valorFechado: valor !== undefined ? formatCurrency(valor, currency) : '',
    }))
  }

  const handleValorSinalChange = (valor: number | undefined) => {
    setValorSinalNumerico(valor)

    setFormData((prev) => ({
      ...prev,
      valorSinal: valor !== undefined ? formatCurrency(valor, currency) : '',
    }))
  }

  const resetAndClose = () => {
    setFormData(baseState)
    setValorNumerico(undefined)
    setValorSinalNumerico(undefined)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: NovoCliente = {
        ...formData,
        dataContato: formatDateISO(formData.dataContato),
      }

      await onSave(payload)
      resetAndClose()
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      // Mostrar erro para o usuário
      alert('Erro ao salvar cliente. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose() }}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto pt-10 sm:pt-12"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          // Permitir que o DatePicker funcione sem fechar o modal
          const target = event.target as Element
          if (target.closest('[data-radix-popper-content-wrapper]')) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            {cliente ? 'Atualizar cliente' : 'Adicionar novo cliente'}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Preencha os dados essenciais para acompanhar a jornada do seu cliente e potencializar as próximas interações.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dataContato">Data de contato *</Label>
              <DatePicker
                id="dataContato"
                value={formData.dataContato}
                onChange={(value) => handleChange('dataContato', value ?? '')}
                placeholder="Selecione a data"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do cliente *</Label>
              <Input
                ref={nameInputRef}
                id="nome"
                name="nome"
                placeholder="Nome completo"
                required
                value={formData.nome}
                onChange={(event) => handleChange('nome', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappInstagram">WhatsApp / Instagram *</Label>
              <Input
                id="whatsappInstagram"
                name="whatsappInstagram"
                placeholder="@usuario ou telefone"
                required
                value={formData.whatsappInstagram}
                onChange={(event) => handleChange('whatsappInstagram', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem">Origem *</Label>
              <Select
                value={formData.origem}
                onValueChange={(value) => handleChange('origem', value)}
              >
                <SelectTrigger id="origem">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((origem) => (
                    <SelectItem key={origem} value={origem}>
                      {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Orçamento enviado *</Label>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Enviar orçamento</p>
                  <p className="text-xs text-muted-foreground">
                    Marque como {`"Sim"`} quando o orçamento foi remetido ao cliente.
                  </p>
                </div>
                <Switch
                  checked={formData.orcamentoEnviado === 'Sim'}
                  onCheckedChange={(checked) =>
                    handleChange('orcamentoEnviado', checked ? 'Sim' : 'Não')
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resultado">Resultado *</Label>
              <Select
                value={formData.resultado}
                onValueChange={(value) => handleChange('resultado', value)}
              >
                <SelectTrigger id="resultado">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {RESULTADOS.map((resultado) => (
                    <SelectItem key={resultado} value={resultado}>
                      {resultado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualidadeContato">Qualidade do contato *</Label>
              <Select
                value={formData.qualidadeContato}
                onValueChange={(value) => handleChange('qualidadeContato', value)}
              >
                <SelectTrigger id="qualidadeContato">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {QUALIDADES.map((qualidade) => (
                    <SelectItem key={qualidade} value={qualidade}>
                      {qualidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cliente não respondeu</Label>
              <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Marcar como não responsivo</p>
                  <p className="text-xs text-muted-foreground">
                    Marque quando o cliente não respondeu às suas mensagens.
                  </p>
                </div>
                <Switch
                  checked={formData.naoRespondeu || false}
                  onCheckedChange={(checked) =>
                    handleChange('naoRespondeu', checked)
                  }
                />
              </div>
            </div>

            {/* Campo valor fechado - só aparece quando orçamento enviado OU resultado = Venda */}
            {(formData.orcamentoEnviado === 'Sim' || formData.resultado === 'Venda') && (
              <div className="space-y-2">
                <Label htmlFor="valorFechado">Valor fechado</Label>
                <MoneyInput
                  id="valorFechado"
                  name="valorFechado"
                  value={valorNumerico}
                  onChangeValue={handleValorChange}
                  currency={currency}
                />
              </div>
            )}
          </div>

          {/* Campos de pagamento - visíveis apenas quando resultado = Venda */}
          {formData.resultado === 'Venda' && (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pagamento do sinal</Label>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3 h-full">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Cliente pagou sinal</p>
                      <p className="text-xs text-muted-foreground">
                        Marque quando o cliente pagar o sinal da venda
                      </p>
                    </div>
                    <Switch
                      checked={formData.pagouSinal || false}
                      onCheckedChange={(checked) =>
                        handleChange('pagouSinal', checked)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status da venda</Label>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3 h-full">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Venda totalmente paga</p>
                      <p className="text-xs text-muted-foreground">
                        Marque quando o cliente finalizar o pagamento completo
                      </p>
                    </div>
                    <Switch
                      checked={formData.vendaPaga || false}
                      onCheckedChange={(checked) =>
                        handleChange('vendaPaga', checked)
                      }
                    />
                  </div>
                </div>
              </div>

              {formData.pagouSinal && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="valorSinal">Valor do sinal *</Label>
                    <MoneyInput
                      id="valorSinal"
                      name="valorSinal"
                      value={valorSinalNumerico}
                      onChangeValue={handleValorSinalChange}
                      currency={currency}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataPagamentoSinal">Data do pagamento do sinal *</Label>
                    <DatePicker
                      id="dataPagamentoSinal"
                      value={formData.dataPagamentoSinal || ''}
                      onChange={(value) => handleChange('dataPagamentoSinal', value ?? '')}
                      placeholder="Selecione a data"
                    />
                  </div>
                </div>
              )}

              {formData.vendaPaga && (
                <div className="space-y-2">
                  <Label htmlFor="dataPagamentoVenda">Data do pagamento completo *</Label>
                  <DatePicker
                    id="dataPagamentoVenda"
                    value={formData.dataPagamentoVenda || ''}
                    onChange={(value) => handleChange('dataPagamentoVenda', value ?? '')}
                    placeholder="Selecione a data"
                  />
                </div>
              )}
            </div>
          )}

          {/* Campo de data de lembrete - disponível para todos */}
          <div className={cn("space-y-2", formData.resultado === 'Venda' && "!mt-12")}>
            <Label htmlFor="dataLembreteChamada">Data para chamar novamente</Label>
            <DatePicker
              id="dataLembreteChamada"
              value={formData.dataLembreteChamada || ''}
              onChange={(value) => handleChange('dataLembreteChamada', value ?? '')}
              placeholder="Selecione quando reativar essa lead"
            />
            <p className="text-xs text-muted-foreground">
              Configure uma data para ser notificado sobre quando chamar este cliente novamente
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea
              id="observacao"
              name="observacao"
              rows={4}
              placeholder="Detalhes que ajudam no acompanhamento do cliente"
              value={formData.observacao}
              onChange={(event) => handleChange('observacao', event.target.value)}
            />
          </div>

          {/* Seção de Follow-ups - apenas quando há cliente existente */}
          {cliente?.id && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Follow-ups</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Documente os follow-ups realizados com este cliente
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsHistoryOpen(true)}
                  >
                    <History className="h-4 w-4" />
                    {followUps.length} follow-up{followUps.length !== 1 ? 's' : ''}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsAddFollowUpOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
              {followUps.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {followUps.slice(0, 3).map((fu) => (
                    <div key={fu.id} className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2">
                      <span className="font-semibold text-foreground">#{fu.numeroFollowup}</span>
                      {' '}
                      <span className="truncate">{fu.observacao}</span>
                    </div>
                  ))}
                  {followUps.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{followUps.length - 3} follow-up{followUps.length - 3 !== 1 ? 's' : ''} mais
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={resetAndClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}
              className={cn('gap-2', isSubmitting && 'cursor-progress')}
            >
              {isSubmitting ? 'Salvando...' : cliente ? 'Atualizar cliente' : 'Salvar cliente'}
            </Button>
          </DialogFooter>
        </form>
        
        {/* Modais de Follow-ups */}
        {cliente?.id && (
          <>
            <AddFollowUpModal
              isOpen={isAddFollowUpOpen}
              onClose={() => {
                setIsAddFollowUpOpen(false)
                setFollowUpParaEditar(null)
              }}
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              onSuccess={async (followUp: FollowUp) => {
                await buscarFollowUps(cliente.id!)
                setFollowUpParaEditar(null)
              }}
              followUpParaEditar={followUpParaEditar}
            />
            <FollowUpHistoryModal
              isOpen={isHistoryOpen}
              onClose={() => setIsHistoryOpen(false)}
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              onAddFollowUp={() => {
                setIsHistoryOpen(false)
                setFollowUpParaEditar(null)
                setIsAddFollowUpOpen(true)
              }}
              onEditFollowUp={(followUp) => {
                setIsHistoryOpen(false)
                setFollowUpParaEditar(followUp)
                setIsAddFollowUpOpen(true)
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
