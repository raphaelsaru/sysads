// Validação allowlist dos argumentos que o LLM produz.
//
// INVARIANTE: o objeto devolvido é construído do zero, campo a campo. Nada
// que o LLM inventou (user_id, table, where...) tem caminho até o SQL.
// `agrupar_por`, `ordenar_por`, `ordem` e `limite` viram TEXTO SQL na etapa
// seguinte — por isso só podem sair de constantes deste arquivo/schema,
// nunca de strings vindas do modelo.

// NodeNext: o specifier é '.js' (aponta para schema.ts em dev/tsx e para o
// emitido em dist). '.ts' aqui quebraria `npm run build`/typecheck (TS5097).
import { METRICAS, AGRUPAMENTOS, RESULTADOS } from './schema.js'

export type Validacao =
  | { ok: true; args: Record<string, any> }
  | { ok: false; motivo: string }

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
const ORDENAVEIS = new Set(['data_contato', 'valor_fechado', 'data_mes_venda'])
const MAX_DIAS = 366 * 20
const MAX_TEXTO = 60

// '2026-02-30' casa com o regex e não vira NaN: o Date rola para 02/03.
// Só o round-trip pega. Devolve null se a data não existir.
function parseData(s: string): Date | null {
  if (!DATA_RE.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(+d) || d.toISOString().slice(0, 10) !== s) return null
  return d
}

function validarPeriodo(a: Record<string, any>): string | null {
  if (typeof a.de !== 'string' || typeof a.ate !== 'string') {
    return 'período ausente'
  }
  const de = parseData(a.de)
  if (!de) return 'data inicial inválida'
  const ate = parseData(a.ate)
  if (!ate) return 'data final inválida'

  if (de > ate) return 'data inicial posterior à final'

  const dias = (+ate - +de) / 86_400_000
  if (dias > MAX_DIAS) return 'período longo demais'
  return null
}

// Ausente = undefined ou null (o modelo emite null para "não definido").
function ausente(v: unknown): boolean {
  return v === undefined || v === null
}

type Filtros =
  | { ok: true; filtros: Record<string, any> }
  | { ok: false; motivo: string }

// Filtro presente e inválido é ERRO, não descarte: descartar alargaria o
// conjunto de resultados e o LLM narraria o número como se estivesse
// filtrado — errado com confiança. Rejeitar deixa o modelo se corrigir.
function extrairFiltros(a: Record<string, any>): Filtros {
  const out: Record<string, any> = {}

  if (!ausente(a.resultado)) {
    if (typeof a.resultado !== 'string' || !(RESULTADOS as readonly string[]).includes(a.resultado)) {
      return { ok: false, motivo: `resultado desconhecido: ${String(a.resultado)}` }
    }
    out.resultado = a.resultado
  }

  // origem/categoria são valores, não identificadores — vão parametrizados.
  for (const campo of ['origem', 'categoria'] as const) {
    const v = a[campo]
    if (ausente(v)) continue
    if (typeof v !== 'string') return { ok: false, motivo: `${campo} deve ser texto` }
    if (v.length > MAX_TEXTO) return { ok: false, motivo: `${campo} longo demais` }
    out[campo] = v
  }

  for (const campo of ['venda_paga', 'nao_respondeu'] as const) {
    const v = a[campo]
    if (ausente(v)) continue
    if (typeof v !== 'boolean') return { ok: false, motivo: `${campo} deve ser booleano` }
    out[campo] = v
  }

  return { ok: true, filtros: out }
}

export function validarArgs(tool: string, bruto: unknown): Validacao {
  // Tool primeiro: nada mais importa se a ferramenta não existe.
  if (tool !== 'agregar_metricas' && tool !== 'contar_leads' && tool !== 'listar_leads') {
    return { ok: false, motivo: `tool desconhecida: ${tool}` }
  }

  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return { ok: false, motivo: 'argumentos ausentes' }
  }
  const a = bruto as Record<string, any>

  const erroPeriodo = validarPeriodo(a)
  if (erroPeriodo) return { ok: false, motivo: erroPeriodo }

  const base = { de: a.de as string, ate: a.ate as string }

  switch (tool) {
    case 'agregar_metricas': {
      if (!Array.isArray(a.metricas) || a.metricas.length === 0) {
        return { ok: false, motivo: 'métricas ausentes' }
      }
      const metricas = a.metricas.filter(
        (m: unknown): m is string =>
          typeof m === 'string' && (METRICAS as readonly string[]).includes(m),
      )
      if (metricas.length !== a.metricas.length) {
        return { ok: false, motivo: 'métrica desconhecida' }
      }
      const agrupar = a.agrupar_por ?? 'nenhum'
      if (typeof agrupar !== 'string' || !(AGRUPAMENTOS as readonly string[]).includes(agrupar)) {
        return { ok: false, motivo: 'agrupamento desconhecido' }
      }
      return { ok: true, args: { ...base, metricas, agrupar_por: agrupar } }
    }

    case 'contar_leads': {
      const f = extrairFiltros(a)
      if (!f.ok) return f
      return { ok: true, args: { ...base, ...f.filtros } }
    }

    case 'listar_leads': {
      const f = extrairFiltros(a)
      if (!f.ok) return f
      const ordenarPor = a.ordenar_por ?? 'data_contato'
      if (typeof ordenarPor !== 'string' || !ORDENAVEIS.has(ordenarPor)) {
        return { ok: false, motivo: 'ordenação não permitida' }
      }
      const ordem = a.ordem === 'asc' ? 'asc' : 'desc'
      const bruta = Number(a.limite ?? 20)
      const limite = Number.isFinite(bruta) ? Math.min(Math.max(1, Math.trunc(bruta)), 50) : 20
      return {
        ok: true,
        args: { ...base, ...f.filtros, ordenar_por: ordenarPor, ordem, limite },
      }
    }
  }
}
