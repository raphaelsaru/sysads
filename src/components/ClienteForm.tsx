'use client'

import { useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { NovoCliente, Cliente } from '@/types/crm'
import { DatePicker } from '@/components/ui/date-picker'

interface ClienteFormProps {
  onSubmit: (cliente: NovoCliente) => void
  onCancel?: () => void
  cliente?: Cliente
  isEditing?: boolean
}

export default function ClienteForm({ onSubmit, onCancel, cliente, isEditing = false }: ClienteFormProps) {
  const getToday = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const [formData, setFormData] = useState<NovoCliente>({
    dataContato: cliente?.dataContato || getToday(),
    nome: cliente?.nome || '',
    whatsappInstagram: cliente?.whatsappInstagram || '',
    origem: cliente?.origem || 'Orgânico / Pefil',
    orcamentoEnviado: cliente?.orcamentoEnviado || 'Não',
    resultado: cliente?.resultado || 'Orçamento em Processo',
    qualidadeContato: cliente?.qualidadeContato || 'Regular',
    valorFechado: cliente?.valorFechado || '',
    observacao: cliente?.observacao || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
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
    <Card className="border-border/70 bg-card/80 shadow-soft">
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
                  <SelectItem value="Orgânico / Pefil">Orgânico / Pefil</SelectItem>
                  <SelectItem value="Anúncio">Anúncio</SelectItem>
                  <SelectItem value="Cliente antigo">Cliente antigo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orcamentoEnviado">Orçamento enviado</Label>
              <Select
                value={formData.orcamentoEnviado}
                onValueChange={(value) => handleChange('orcamentoEnviado', value)}
              >
                <SelectTrigger id="orcamentoEnviado">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resultado">Resultado</Label>
              <Select
                value={formData.resultado}
                onValueChange={(value) => handleChange('resultado', value)}
              >
                <SelectTrigger id="resultado">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Orçamento em Processo">Orçamento em Processo</SelectItem>
                  <SelectItem value="Não Venda">Não Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualidadeContato">Qualidade do contato</Label>
              <Select
                value={formData.qualidadeContato}
                onValueChange={(value) => handleChange('qualidadeContato', value)}
              >
                <SelectTrigger id="qualidadeContato">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bom">Bom</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Ruim">Ruim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorFechado">Valor fechado</Label>
              <Input
                id="valorFechado"
                value={formData.valorFechado}
                onChange={(event) => handleChange('valorFechado', event.target.value)}
                placeholder="R$ 0,00"
              />
            </div>
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

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="sm:min-w-[160px]">
                Cancelar
              </Button>
            )}
            <Button type="submit" className="sm:min-w-[200px]">
              {isEditing ? 'Atualizar cliente' : 'Adicionar cliente'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
