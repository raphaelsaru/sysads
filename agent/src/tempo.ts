// "Hoje" na zona do usuário.
//
// O assistente resolve períodos relativos ("este mês", "últimos 30 dias") a
// partir de uma data. Calcular essa data em UTC é bug real: às 21h de Brasília
// o UTC já virou o dia seguinte, e o estúdio pediria "hoje" e receberia amanhã.
// Pior ainda para os estúdios em USD, que não estão em Brasília.
//
// A zona vem do cliente (Intl.DateTimeFormat().resolvedOptions().timeZone) e é
// validada aqui. Não é fronteira de segurança: uma zona hostil só desloca quais
// datas o modelo escolhe para os dados DO PRÓPRIO usuário. Validamos por
// correção — e para não estourar RangeError dentro do request.

export const ZONA_PADRAO = 'America/Sao_Paulo'

export function zonaValida(tz: unknown): tz is string {
  if (typeof tz !== 'string') return false
  const t = tz.trim()
  // Teto de tamanho antes de entregar ao Intl: nome de zona IANA real é curto.
  if (t === '' || t.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: t })
    return true
  } catch {
    return false
  }
}

/** Data de hoje (YYYY-MM-DD) na zona informada; zona inválida cai no padrão pt-BR. */
export function hojeNaZona(tz?: unknown, agora: Date = new Date()): string {
  const zona = zonaValida(tz) ? tz : ZONA_PADRAO
  // en-CA formata como YYYY-MM-DD, que é o formato que as tools esperam.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}
