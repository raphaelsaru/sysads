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

interface ClienteModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (cliente: NovoCliente) => void
  cliente?: Cliente
  currency?: SupportedCurrency
}

const ORIGENS: NovoCliente['origem'][] = ['Indicação', 'Orgânico / Pefil', 'Anúncio', 'Cliente antigo']
const RESULTADOS: NovoCliente['resultado'][] = ['Venda', 'Orçamento em Processo', 'Não Venda']
const QUALIDADES: NovoCliente['qualidadeContato'][] = ['Bom', 'Regular', 'Ruim']

export default function ClienteModal({ isOpen, onClose, onSave, cliente, currency = FALLBACK_CURRENCY_VALUE }: ClienteModalProps) {
  const baseState: NovoCliente = useMemo(
    () => ({
      dataContato: getTodayBR(),
      nome: '',
      whatsappInstagram: '',
      origem: 'Orgânico / Pefil',
      orcamentoEnviado: 'Não',
      resultado: 'Orçamento em Processo',
      qualidadeContato: 'Regular',
      valorFechado: '',
      observacao: '',
    }),
    []
  )

  const [formData, setFormData] = useState<NovoCliente>(baseState)
  const [valorNumerico, setValorNumerico] = useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

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
        valorFechado: cliente.valorFechado || '',
        observacao: cliente.observacao || '',
      })
      setValorNumerico(
        cliente.valorFechadoNumero !== null && cliente.valorFechadoNumero !== undefined
          ? cliente.valorFechadoNumero
          : undefined
      )
    } else {
      setFormData(baseState)
      setValorNumerico(undefined)
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
    value: string
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

  const resetAndClose = () => {
    setFormData(baseState)
    setValorNumerico(undefined)
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
                    Marque como &quot;Sim&quot; quando o orçamento foi remetido ao cliente.
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
              <Label htmlFor="valorFechado">Valor fechado</Label>
              <MoneyInput
                id="valorFechado"
                name="valorFechado"
                value={valorNumerico}
                onChangeValue={handleValorChange}
                currency={currency}
              />
            </div>
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
      </DialogContent>
    </Dialog>
  )
}
