import { useMemo, useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { router } from 'expo-router'

import { ORIGENS, QUALIDADES, RESULTADOS } from '@core/constants/clientes'
import type { NovoCliente } from '@core/types/crm'
import { useClientes } from '@hooks/useClientes'
import {
  Screen,
  Typography,
  TextField,
  Button,
  ChipGroup,
  Card,
  usePrizelyTheme,
} from '@design-system'

const todayISO = () => new Date().toISOString().slice(0, 10)

const baseState: NovoCliente = {
  dataContato: todayISO(),
  nome: '',
  whatsappInstagram: '',
  origem: ORIGENS[0],
  orcamentoEnviado: 'Não',
  resultado: RESULTADOS[1],
  qualidadeContato: QUALIDADES[1],
  valorFechado: '',
  observacao: '',
}

export default function CreateClientScreen() {
  const { criarCliente, criandoCliente } = useClientes()
  const [form, setForm] = useState<NovoCliente>(baseState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const theme = usePrizelyTheme()

  const isValid = useMemo(() => {
    return form.nome.trim().length > 0 && form.whatsappInstagram.trim().length > 0
  }, [form.nome, form.whatsappInstagram])

  const updateField = <K extends keyof NovoCliente>(key: K, value: NovoCliente[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }

  const handleSubmit = async () => {
    if (!isValid) {
      const nextErrors: Record<string, string> = {}
      if (!form.nome.trim()) nextErrors.nome = 'Informe o nome do cliente'
      if (!form.whatsappInstagram.trim()) nextErrors.whatsappInstagram = 'Informe um contato'
      setErrors(nextErrors)
      return
    }

    try {
      await criarCliente({ ...form, dataContato: form.dataContato || todayISO() })
      Alert.alert('Cliente criado', 'O cliente foi adicionado com sucesso.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao criar cliente.'
      Alert.alert('Não foi possível salvar', message)
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Typography variant="titleMd">Adicionar cliente</Typography>
          <Typography variant="body" tone="muted">
            Preencha as informações essenciais para acompanhar o relacionamento.
          </Typography>
        </View>

        <Card style={{ gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Field label="Nome do cliente" error={errors.nome}>
              <TextField
                placeholder="Nome completo"
                value={form.nome}
                onChangeText={(value) => updateField('nome', value)}
              />
            </Field>

            <Field label="WhatsApp / Instagram" error={errors.whatsappInstagram}>
              <TextField
                placeholder="@usuario ou telefone"
                value={form.whatsappInstagram}
                onChangeText={(value) => updateField('whatsappInstagram', value)}
              />
            </Field>

            <Field label="Data de contato">
              <TextField
                placeholder="AAAA-MM-DD"
                value={form.dataContato}
                onChangeText={(value) => updateField('dataContato', value)}
              />
            </Field>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            <Field label="Origem">
              <ChipGroup
                options={ORIGENS.map((origem) => ({ label: origem, value: origem }))}
                value={form.origem}
                onChange={(value: typeof form.origem) => updateField('origem', value)}
              />
            </Field>

            <Field label="Orçamento enviado">
              <ChipGroup
                options={[{ label: 'Sim', value: 'Sim' }, { label: 'Não', value: 'Não' }]}
                value={form.orcamentoEnviado}
                onChange={(value: typeof form.orcamentoEnviado) => updateField('orcamentoEnviado', value)}
              />
            </Field>

            <Field label="Resultado">
              <ChipGroup
                options={RESULTADOS.map((resultado) => ({ label: resultado, value: resultado }))}
                value={form.resultado}
                onChange={(value: typeof form.resultado) => updateField('resultado', value)}
              />
            </Field>

            <Field label="Qualidade do contato">
              <ChipGroup
                options={QUALIDADES.map((qualidade) => ({ label: qualidade, value: qualidade }))}
                value={form.qualidadeContato}
                onChange={(value: typeof form.qualidadeContato) => updateField('qualidadeContato', value)}
              />
            </Field>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Field label="Valor fechado (opcional)">
              <TextField
                placeholder="Ex: 1500,00"
                keyboardType="decimal-pad"
                value={form.valorFechado ?? ''}
                onChangeText={(value) => updateField('valorFechado', value)}
              />
            </Field>

            <Field label="Observação (opcional)">
              <TextField
                placeholder="Notas adicionais"
                value={form.observacao ?? ''}
                onChangeText={(value) => updateField('observacao', value)}
                multiline
                numberOfLines={4}
                style={{ minHeight: 120, textAlignVertical: 'top' }}
              />
            </Field>
          </View>

          <Button onPress={handleSubmit} loading={criandoCliente} disabled={!isValid} fullWidth>
            Salvar cliente
          </Button>
        </Card>
      </ScrollView>
    </Screen>
  )
}

const Field = ({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) => (
  <View style={{ gap: 6 }}>
    <Typography variant="bodyBold">{label}</Typography>
    {children}
    {error ? (
      <Typography variant="caption" tone="destructive">
        {error}
      </Typography>
    ) : null}
  </View>
)
