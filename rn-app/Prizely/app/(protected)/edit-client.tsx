import { useMemo, useState, useEffect } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

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

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { clientes, atualizarCliente, atualizandoCliente } = useClientes()
  const theme = usePrizelyTheme()

  const cliente = clientes.find((c) => c.id === id)

  const [form, setForm] = useState<NovoCliente>({
    dataContato: '',
    nome: '',
    whatsappInstagram: '',
    origem: ORIGENS[0],
    orcamentoEnviado: 'Não',
    resultado: RESULTADOS[1],
    qualidadeContato: QUALIDADES[1],
    valorFechado: '',
    observacao: '',
  })

  const [dataContato, setDataContato] = useState<Date>(new Date())
  const [orcamentoEnviado, setOrcamentoEnviado] = useState(false)
  const [valorFechadoNumeros, setValorFechadoNumeros] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (cliente) {
      setForm({
        dataContato: cliente.dataContato,
        nome: cliente.nome,
        whatsappInstagram: cliente.whatsappInstagram,
        origem: cliente.origem,
        orcamentoEnviado: cliente.orcamentoEnviado,
        resultado: cliente.resultado,
        qualidadeContato: cliente.qualidadeContato,
        valorFechado: cliente.valorFechadoNumero?.toString() ?? '',
        observacao: cliente.observacao ?? '',
      })

      if (cliente.dataContato) {
        const [year, month, day] = cliente.dataContato.split('-').map(Number)
        setDataContato(new Date(year, month - 1, day))
      }

      setOrcamentoEnviado(cliente.orcamentoEnviado === 'Sim')

      if (cliente.valorFechadoNumero) {
        setValorFechadoNumeros(cliente.valorFechadoNumero.toString())
      }
    }
  }, [cliente])

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
    const numbers = text.replace(/\D/g, '')
    setValorFechadoNumeros(numbers)
    updateField('valorFechado', numbers)
  }

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

    if (!id) {
      Alert.alert('Erro', 'Cliente não encontrado')
      return
    }

    try {
      const dataContatoISO = dataContato.toISOString().slice(0, 10)
      const payload = {
        ...form,
        dataContato: dataContatoISO,
        orcamentoEnviado: orcamentoEnviado ? 'Sim' : 'Não',
      }

      await atualizarCliente({ id, payload })

      Alert.alert('Cliente atualizado', 'As alterações foram salvas com sucesso.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error)
      const message = error instanceof Error ? error.message : 'Erro inesperado ao atualizar cliente.'
      Alert.alert('Não foi possível salvar', message)
    }
  }

  if (!cliente) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }}>
          <Typography variant="titleMd">Cliente não encontrado</Typography>
          <Button onPress={() => router.back()} style={{ marginTop: theme.spacing.lg }}>
            Voltar
          </Button>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
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

          <Button onPress={handleSubmit} loading={atualizandoCliente} disabled={!isValid} fullWidth>
            Salvar alterações
          </Button>
        </Card>
      </ScrollView>
    </Screen>
  )
}

const Field = ({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) => (
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
