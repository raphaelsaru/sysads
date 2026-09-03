'use client'

import { useEffect, useMemo, useState } from 'react'

import { getTodayBR, formatDateISO } from '@/lib/dateUtils'
import { Negociacao, NovaNegociacao } from '@/types/crm'
import { cn } from '@/lib/utils'
import MoneyInput from './MoneyInput'
import { Button } from '@/components/ui/button'
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

export interface NegociacaoFormProps {
  clienteId: string
  negociacao?: Negociacao
  onSave: (data: NovaNegociacao | Partial<NovaNegociacao>) => void | Promise<void>
  onCancel: () => void
  currency?: SupportedCurrency
}

const RESULTADOS: Negociacao['resultado'][] = ['Venda', 'Orçamento em Processo', 'Não Venda']
const QUALIDADES: NonNullable<Negociacao['qualidadeContato']>[] = ['Bom', 'Regular', 'Ruim']

export default function NegociacaoForm({
  clienteId,
  negociacao,
  onSave,
  onCancel,
  currency = FALLBACK_CURRENCY_VALUE,
}: NegociacaoFormProps) {
  const baseState: NovaNegociacao = useMemo(
    () => ({
      clienteId,
      dataContato: getTodayBR(),
      orcamentoEnviado: false,
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
    [clienteId]
  )

  const [formData, setFormData] = useState<NovaNegociacao>(baseState)
  const [valorNumerico, setValorNumerico] = useState<number | undefined>()
  const [valorSinalNumerico, setValorSinalNumerico] = useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (negociacao) {
      setFormData({
        clienteId: negociacao.clienteId,
        dataContato: negociacao.dataContato,
        orcamentoEnviado: negociacao.orcamentoEnviado,
        resultado: negociacao.resultado,
        qualidadeContato: negociacao.qualidadeContato,
        naoRespondeu: negociacao.naoRespondeu || false,
        valorFechado: negociacao.valorFechado || '',
        observacao: negociacao.observacao || '',
        pagouSinal: negociacao.pagouSinal || false,
        valorSinal: negociacao.valorSinal || '',
        dataPagamentoSinal: negociacao.dataPagamentoSinal || '',
        vendaPaga: negociacao.vendaPaga || false,
        dataPagamentoVenda: negociacao.dataPagamentoVenda || '',
        dataLembreteChamada: negociacao.dataLembreteChamada || '',
      })
      setValorNumerico(
        negociacao.valorFechadoNumero !== null && negociacao.valorFechadoNumero !== undefined
          ? negociacao.valorFechadoNumero
          : undefined
      )
      setValorSinalNumerico(
        negociacao.valorSinalNumero !== null && negociacao.valorSinalNumero !== undefined
          ? negociacao.valorSinalNumero
          : undefined
      )
    } else {
      setFormData(baseState)
      setValorNumerico(undefined)
      setValorSinalNumerico(undefined)
    }
  }, [negociacao, baseState])

  const handleChange = <K extends keyof NovaNegociacao>(field: K, value: NovaNegociacao[K]) => {
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
          <Label>Orçamento enviado *</Label>
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Enviar orçamento</p>
              <p className="text-xs text-muted-foreground">
                Marque quando o orçamento foi remetido ao cliente.
              </p>
            </div>
            <Switch
              checked={formData.orcamentoEnviado}
              onCheckedChange={(checked) => handleChange('orcamentoEnviado', checked)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resultado">Resultado *</Label>
          <Select
            value={formData.resultado}
            onValueChange={(value) => handleChange('resultado', value as Negociacao['resultado'])}
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
          <Label htmlFor="qualidadeContato">Qualidade do contato</Label>
          <Select
            value={formData.qualidadeContato}
            onValueChange={(value) =>
              handleChange('qualidadeContato', value as Negociacao['qualidadeContato'])
            }
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
              onCheckedChange={(checked) => handleChange('naoRespondeu', checked)}
            />
          </div>
        </div>

        {/* Campo valor fechado - só aparece quando orçamento enviado OU resultado = Venda */}
        {(formData.orcamentoEnviado || formData.resultado === 'Venda') && (
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
                  onCheckedChange={(checked) => handleChange('pagouSinal', checked)}
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
                  onCheckedChange={(checked) => handleChange('vendaPaga', checked)}
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
      <div className={cn('space-y-2', formData.resultado === 'Venda' && '!mt-12')}>
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
