import { useEffect, useMemo, useState } from 'react'

import { getTodayBR } from '@/lib/dateUtils'
import { Negociacao, NovaNegociacao } from '@/types/crm'
import { FALLBACK_CURRENCY_VALUE, formatCurrency, type SupportedCurrency } from '@/lib/currency'

export function useNegociacaoFormState(
  clienteId: string,
  negociacao: Negociacao | undefined,
  currency: SupportedCurrency = FALLBACK_CURRENCY_VALUE
) {
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
      procedimento: '',
      motivoNaoVenda: '',
      formaPagamentoSinal: '',
    }),
    [clienteId]
  )

  const [formData, setFormData] = useState<NovaNegociacao>(baseState)
  const [valorNumerico, setValorNumerico] = useState<number | undefined>()
  const [valorSinalNumerico, setValorSinalNumerico] = useState<number | undefined>()

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
        procedimento: negociacao.procedimento || '',
        motivoNaoVenda: negociacao.motivoNaoVenda || '',
        formaPagamentoSinal: negociacao.formaPagamentoSinal || '',
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

  // valorFechado só aparece quando orcamentoEnviado || resultado === 'Venda'
  const handleResultadoChange = (value: Negociacao['resultado']) => {
    const wasVenda = formData.resultado === 'Venda'
    const willBeVenda = value === 'Venda'
    const wasValorVisible = formData.orcamentoEnviado || wasVenda
    const willBeValorVisible = formData.orcamentoEnviado || willBeVenda

    setFormData((prev) => ({
      ...prev,
      resultado: value,
      ...(wasVenda && !willBeVenda
        ? {
            pagouSinal: false,
            valorSinal: '',
            dataPagamentoSinal: '',
            vendaPaga: false,
            dataPagamentoVenda: '',
            formaPagamentoSinal: '',
          }
        : {}),
      // motivo de não venda não se aplica a Venda
      ...(willBeVenda ? { motivoNaoVenda: '' } : {}),
      ...(wasValorVisible && !willBeValorVisible ? { valorFechado: '' } : {}),
    }))

    if (wasVenda && !willBeVenda) {
      setValorSinalNumerico(undefined)
    }
    if (wasValorVisible && !willBeValorVisible) {
      setValorNumerico(undefined)
    }
  }

  const handleOrcamentoEnviadoChange = (checked: boolean) => {
    const wasValorVisible = formData.orcamentoEnviado || formData.resultado === 'Venda'
    const willBeValorVisible = checked || formData.resultado === 'Venda'

    setFormData((prev) => ({
      ...prev,
      orcamentoEnviado: checked,
      ...(wasValorVisible && !willBeValorVisible ? { valorFechado: '' } : {}),
    }))

    if (wasValorVisible && !willBeValorVisible) {
      setValorNumerico(undefined)
    }
  }

  const handlePagouSinalChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      pagouSinal: checked,
      ...(!checked ? { valorSinal: '', dataPagamentoSinal: '', formaPagamentoSinal: '' } : {}),
    }))

    if (!checked) {
      setValorSinalNumerico(undefined)
    }
  }

  const handleVendaPagaChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      vendaPaga: checked,
      ...(!checked ? { dataPagamentoVenda: '' } : {}),
    }))
  }

  return {
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
  }
}
