/**
 * Definições das tools expostas ao LLM.
 *
 * INVARIANTE: nenhuma tool aceita `user_id`. O escopo é injetado pelo
 * servidor em montarSQL(). Se um `user_id` aparecer aqui, é bug de segurança.
 */

export const METRICAS = [
  'leads', 'vendas', 'faturamento', 'ticket_medio', 'taxa_conversao',
  'sinais_pagos', 'valor_sinais', 'nao_respondeu', 'orcamentos_enviados',
] as const

export const AGRUPAMENTOS = [
  'nenhum', 'mes', 'trimestre', 'ano', 'origem', 'categoria', 'qualidade',
] as const

export const RESULTADOS = [
  'Venda', 'Orçamento em Processo', 'Não Venda', 'Cancelado',
  'Remarque', 'Faltou', 'Desmarcado', 'Lista de Espera',
] as const

const periodo = {
  de: { type: 'string', description: 'Data inicial, formato YYYY-MM-DD' },
  ate: { type: 'string', description: 'Data final, formato YYYY-MM-DD' },
}

const filtros = {
  resultado: { type: 'string', enum: RESULTADOS },
  origem: { type: 'string' },
  categoria: { type: 'string' },
  venda_paga: { type: 'boolean' },
  nao_respondeu: { type: 'boolean' },
}

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'agregar_metricas',
      description:
        'Calcula métricas agregadas dos leads/vendas no período. Use para ' +
        'relatórios, totais, comparações entre períodos e quebras por dimensão. ' +
        'Os números já vêm calculados pelo banco — nunca recalcule.',
      parameters: {
        type: 'object',
        properties: {
          ...periodo,
          agrupar_por: { type: 'string', enum: AGRUPAMENTOS, default: 'nenhum' },
          metricas: {
            type: 'array',
            items: { type: 'string', enum: METRICAS },
            minItems: 1,
          },
        },
        required: ['de', 'ate', 'metricas'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'contar_leads',
      description:
        'Conta leads que batem com os filtros. Barato — prefira sobre listar ' +
        'quando só precisa do número.',
      parameters: {
        type: 'object',
        properties: { ...periodo, ...filtros },
        required: ['de', 'ate'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_leads',
      description:
        'Lista leads individuais. Use para perguntas sobre casos específicos ' +
        '(ex.: "as 5 maiores vendas de julho"). Máximo 50 linhas.',
      parameters: {
        type: 'object',
        properties: {
          ...periodo,
          ...filtros,
          ordenar_por: {
            type: 'string',
            enum: ['data_contato', 'valor_fechado', 'data_mes_venda'],
            default: 'data_contato',
          },
          ordem: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          limite: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
        required: ['de', 'ate'],
        additionalProperties: false,
      },
    },
  },
] as const
