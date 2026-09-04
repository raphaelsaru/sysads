'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { NovoCliente, Cliente, NovaNegociacao } from '@/types/crm'
import { DatePicker } from '@/components/ui/date-picker'
import { getCategoriasParaUsuario } from '@/lib/leadCategoria'
import { formatDateISO } from '@/lib/dateUtils'
import { FALLBACK_CURRENCY_VALUE, type SupportedCurrency } from '@/lib/currency'
import { useNegociacaoFormState } from '@/hooks/useNegociacaoFormState'
import NegociacaoFormFields from './NegociacaoFormFields'

type NegociacaoInicial = Omit<NovaNegociacao, 'clienteId'>

interface ClienteFormProps {
  onSubmit: (cliente: NovoCliente, negociacaoInicial?: NegociacaoInicial) => void | Promise<void>
  onCancel?: () => void
  cliente?: Cliente
  isEditing?: boolean
  userId?: string | null
  currency?: SupportedCurrency
}

export default function ClienteForm({
  onSubmit,
  onCancel,
  cliente,
  isEditing = false,
  userId,
  currency = FALLBACK_CURRENCY_VALUE,
}: ClienteFormProps) {
  const categorias = useMemo(() => getCategoriasParaUsuario(userId), [userId])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mostrarNegociacao, setMostrarNegociacao] = useState(false)
  const negociacaoFormState = useNegociacaoFormState('', undefined, currency)

  const getToday = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const [formData, setFormData] = useState<NovoCliente>({
    dataContato: cliente?.dataContato || getToday(),
    nome: cliente?.nome || '',
    whatsappInstagram: cliente?.whatsappInstagram || '',
    origem: cliente?.origem || 'Orgânico / Perfil',
    observacao: cliente?.observacao || '',
    categoria: cliente?.categoria || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (mostrarNegociacao) {
        const negForm = negociacaoFormState.formData
        const negociacaoInicial: NegociacaoInicial = {
          dataContato: formatDateISO(negForm.dataContato),
          orcamentoEnviado: negForm.orcamentoEnviado,
          resultado: negForm.resultado,
          qualidadeContato: negForm.qualidadeContato,
          naoRespondeu: negForm.naoRespondeu,
          valorFechado: negForm.valorFechado,
          observacao: negForm.observacao,
          pagouSinal: negForm.pagouSinal,
          valorSinal: negForm.valorSinal,
          dataPagamentoSinal: negForm.dataPagamentoSinal,
          vendaPaga: negForm.vendaPaga,
          dataPagamentoVenda: negForm.dataPagamentoVenda,
          dataLembreteChamada: negForm.dataLembreteChamada,
        }
        await onSubmit(formData, negociacaoInicial)
      } else {
        await onSubmit(formData)
      }
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      alert('Erro ao salvar cliente. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (
    field: keyof NovoCliente,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
 <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Editar cliente' : 'Novo cliente'}</CardTitle>
        <CardDescription>
          Organize os dados essenciais para acompanhar o relacionamento e acelerar suas conversões.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dataContato">Data de contato</Label>
              <DatePicker
                id="dataContato"
                value={formData.dataContato}
                onChange={(value) => handleChange('dataContato', value ?? '')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do cliente</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(event) => handleChange('nome', event.target.value)}
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappInstagram">WhatsApp / Instagram</Label>
              <Input
                id="whatsappInstagram"
                value={formData.whatsappInstagram}
                onChange={(event) => handleChange('whatsappInstagram', event.target.value)}
                placeholder="@usuario ou telefone"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Select
                value={formData.origem}
                onValueChange={(value) => handleChange('origem', value)}
              >
                <SelectTrigger id="origem">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Orgânico / Perfil">Orgânico / Perfil</SelectItem>
                  <SelectItem value="Anúncio">Anúncio</SelectItem>
                  <SelectItem value="Cliente antigo">Cliente antigo</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {categorias.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={formData.categoria || ''}
                  onValueChange={(value) => handleChange('categoria', value)}
                >
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>
                        {categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(event) => handleChange('observacao', event.target.value)}
              rows={3}
              placeholder="Observações sobre o cliente ou atendimento"
            />
          </div>

          {!isEditing && (
            <div className="space-y-4 border-t border-border/70 pt-4">
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Já lançar a primeira negociação?</p>
                  <p className="text-xs text-muted-foreground">
                    Opcional. Preencha para não precisar entrar na página do lead depois.
                  </p>
                </div>
                <Switch checked={mostrarNegociacao} onCheckedChange={setMostrarNegociacao} />
              </div>

              {mostrarNegociacao && (
                <div className="space-y-6 rounded-lg border border-border/70 p-4">
                  <NegociacaoFormFields {...negociacaoFormState} currency={currency} idPrefix="negociacao-" />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="sm:min-w-[160px]">
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting} className="sm:min-w-[200px]">
              {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar cliente' : 'Adicionar cliente'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
