'use client'

import { Negociacao, NovaNegociacao } from '@/types/crm'
import { cn } from '@/lib/utils'
import MoneyInput from './MoneyInput'
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
import { FALLBACK_CURRENCY_VALUE, type SupportedCurrency } from '@/lib/currency'
import { DatePicker } from '@/components/ui/date-picker'

const RESULTADOS: Negociacao['resultado'][] = ['Venda', 'Orçamento em Processo', 'Não Venda']
const QUALIDADES: NonNullable<Negociacao['qualidadeContato']>[] = ['Bom', 'Regular', 'Ruim']

export interface NegociacaoFormFieldsProps {
  formData: NovaNegociacao
  valorNumerico: number | undefined
  valorSinalNumerico: number | undefined
  handleChange: <K extends keyof NovaNegociacao>(field: K, value: NovaNegociacao[K]) => void
  handleValorChange: (valor: number | undefined) => void
  handleValorSinalChange: (valor: number | undefined) => void
  handleResultadoChange: (value: Negociacao['resultado']) => void
  handleOrcamentoEnviadoChange: (checked: boolean) => void
  handlePagouSinalChange: (checked: boolean) => void
  handleVendaPagaChange: (checked: boolean) => void
  currency?: SupportedCurrency
  idPrefix?: string
}

export default function NegociacaoFormFields({
  formData,
  valorNumerico,
  valorSinalNumerico,
  handleChange,
  handleValorChange,
  handleValorSinalChange,
  handleResultadoChange,
  handleOrcamentoEnviadoChange,
  handlePagouSinalChange,
  handleVendaPagaChange,
  currency = FALLBACK_CURRENCY_VALUE,
  idPrefix = '',
}: NegociacaoFormFieldsProps) {
  const id = (name: string) => `${idPrefix}${name}`

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id('dataContato')}>Data de contato *</Label>
          <DatePicker
            id={id('dataContato')}
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
              onCheckedChange={handleOrcamentoEnviadoChange}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={id('resultado')}>Resultado *</Label>
          <Select
            value={formData.resultado}
            onValueChange={(value) => handleResultadoChange(value as Negociacao['resultado'])}
          >
            <SelectTrigger id={id('resultado')}>
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
          <Label htmlFor={id('qualidadeContato')}>Qualidade do contato</Label>
          <Select
            value={formData.qualidadeContato}
            onValueChange={(value) =>
              handleChange('qualidadeContato', value as Negociacao['qualidadeContato'])
            }
          >
            <SelectTrigger id={id('qualidadeContato')}>
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
            <Label htmlFor={id('valorFechado')}>Valor fechado</Label>
            <MoneyInput
              id={id('valorFechado')}
              name={id('valorFechado')}
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
                  onCheckedChange={handlePagouSinalChange}
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
                  onCheckedChange={handleVendaPagaChange}
                />
              </div>
            </div>
          </div>

          {formData.pagouSinal && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={id('valorSinal')}>Valor do sinal *</Label>
                <MoneyInput
                  id={id('valorSinal')}
                  name={id('valorSinal')}
                  value={valorSinalNumerico}
                  onChangeValue={handleValorSinalChange}
                  currency={currency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={id('dataPagamentoSinal')}>Data do pagamento do sinal *</Label>
                <DatePicker
                  id={id('dataPagamentoSinal')}
                  value={formData.dataPagamentoSinal || ''}
                  onChange={(value) => handleChange('dataPagamentoSinal', value ?? '')}
                  placeholder="Selecione a data"
                />
              </div>
            </div>
          )}

          {formData.vendaPaga && (
            <div className="space-y-2">
              <Label htmlFor={id('dataPagamentoVenda')}>Data do pagamento completo *</Label>
              <DatePicker
                id={id('dataPagamentoVenda')}
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
        <Label htmlFor={id('dataLembreteChamada')}>Data para chamar novamente</Label>
        <DatePicker
          id={id('dataLembreteChamada')}
          value={formData.dataLembreteChamada || ''}
          onChange={(value) => handleChange('dataLembreteChamada', value ?? '')}
          placeholder="Selecione quando reativar essa lead"
        />
        <p className="text-xs text-muted-foreground">
          Configure uma data para ser notificado sobre quando chamar este cliente novamente
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id('observacao')}>Observações</Label>
        <Textarea
          id={id('observacao')}
          name={id('observacao')}
          rows={4}
          placeholder="Detalhes que ajudam no acompanhamento do cliente"
          value={formData.observacao}
          onChange={(event) => handleChange('observacao', event.target.value)}
        />
      </div>
    </>
  )
}
