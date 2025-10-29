import { useMemo, useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { router } from 'expo-router'

import { ORIGENS, QUALIDADES, RESULTADOS } from '@core/constants/clientes'
import type { NovoCliente } from '@core/types/crm'
import { useClientes } from '@hooks/useClientes'
import { formatCurrencyInput } from '@core/utils/currency'
import {
  Screen,
  Typography,
  TextField,
  Button,
  ChipGroup,
  Card,
  DatePicker,
  Switch,
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
  naoRespondeu: false,
  valorFechado: '',
  observacao: '',
}

export default function CreateClientScreen() {
  const { criarCliente, criandoCliente } = useClientes()
  const [form, setForm] = useState<NovoCliente>(baseState)
  const [dataContato, setDataContato] = useState<Date>(new Date())
  const [orcamentoEnviado, setOrcamentoEnviado] = useState(false)
  const [valorFechadoNumeros, setValorFechadoNumeros] = useState('')
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

  const handleValorFechadoChange = (text: string) => {
    // Apenas aceitar números
    const numbers = text.replace(/\D/g, '')

    // Atualizar estado com apenas números
    setValorFechadoNumeros(numbers)

    // Armazenar no form para envio
    updateField('valorFechado', numbers)
  }

  // Computar valor formatado para exibição
  const valorFechadoFormatado = useMemo(() => {
    if (!valorFechadoNumeros) return ''
    return formatCurrencyInput(valorFechadoNumeros)
  }, [valorFechadoNumeros])

  const handleSubmit = async () => {
    if (!isValid) {
      const nextErrors: Record<string, string> = {}
      if (!form.nome.trim()) nextErrors.nome = 'Informe o nome do cliente'
      if (!form.whatsappInstagram.trim()) nextErrors.whatsappInstagram = 'Informe um contato'
      setErrors(nextErrors)
      return
    }

    try {
      const dataContatoISO = dataContato.toISOString().slice(0, 10)
      const payload = {
        ...form,
        dataContato: dataContatoISO,
        orcamentoEnviado: orcamentoEnviado ? 'Sim' : 'Não',
      }

      console.log('📤 Enviando cliente:', JSON.stringify(payload, null, 2))

      await criarCliente(payload)

      Alert.alert('Cliente criado', 'O cliente foi adicionado com sucesso.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error)
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
            <Field label="Data de contato">
              <DatePicker value={dataContato} onChange={setDataContato} />
            </Field>

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
              <Switch
                value={orcamentoEnviado}
                onValueChange={setOrcamentoEnviado}
                label={orcamentoEnviado ? 'Sim' : 'Não'}
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

            <Field label="Cliente não respondeu">
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm }}>
                <Typography variant="body" style={{ flex: 1 }}>
                  Marcar como não responsivo
                </Typography>
                <Switch
                  value={form.naoRespondeu || false}
                  onValueChange={(value) => updateField('naoRespondeu', value)}
                />
              </View>
            </Field>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Field label="Valor fechado (opcional)">
              <TextField
                placeholder="0,00"
                keyboardType="number-pad"
                value={valorFechadoNumeros}
                onChangeText={handleValorFechadoChange}
              />
              {valorFechadoFormatado && (
                <Typography variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  {valorFechadoFormatado}
                </Typography>
              )}
            </Field>

            <Field label="Observação (opcional)">
              <TextField
                placeholder="Notas adicionais"
                value={form.observacao ?? ''}
                onChangeText={(value) => updateField('observacao', value)}
                multiline
                numberOfLines={4}
                style={{
                  minHeight: 120,
                  textAlignVertical: 'top',
                  paddingTop: theme.spacing.sm,
                }}
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
