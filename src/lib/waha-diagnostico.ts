// Diagnóstico temporário do webhook WAHA: descobrir onde o engine (NOWEB/WEBJS/GOWS)
// manda o nome do contato e se mensagens de anúncio trazem ctwa_clid.
// Guarda só nomes de chaves + valores de campos de nome/anúncio — nunca texto da conversa.

const CHAVE_RELEVANTE = /name|ctwa|clid|referral|conversion|entrypoint|^source(id|url|type|app)$|^adid$/i
const MAX_PROFUNDIDADE = 10
const MAX_CAMPOS = 40

export type CamposDiagnostico = {
  chavesPayload: string[]
  chavesData: string[]
  campos: Record<string, string | number | boolean>
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function extrairCamposDiagnostico(payload: unknown): CamposDiagnostico {
  const campos: CamposDiagnostico['campos'] = {}

  const visitar = (valor: unknown, caminho: string, profundidade: number) => {
    if (profundidade > MAX_PROFUNDIDADE || Object.keys(campos).length >= MAX_CAMPOS) return
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => visitar(item, `${caminho}[${i}]`, profundidade + 1))
      return
    }
    if (!ehObjeto(valor)) return
    for (const [chave, v] of Object.entries(valor)) {
      const atual = caminho ? `${caminho}.${chave}` : chave
      if (['string', 'number', 'boolean'].includes(typeof v)) {
        if (CHAVE_RELEVANTE.test(chave)) {
          campos[atual] = typeof v === 'string' ? v.slice(0, 200) : (v as number | boolean)
        }
      } else {
        visitar(v, atual, profundidade + 1)
      }
    }
  }

  visitar(payload, '', 0)

  return {
    chavesPayload: ehObjeto(payload) ? Object.keys(payload) : [],
    chavesData: ehObjeto(payload) && ehObjeto(payload._data) ? Object.keys(payload._data) : [],
    campos,
  }
}
