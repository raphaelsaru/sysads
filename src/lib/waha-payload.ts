// Nome do contato no payload de mensagem do WAHA. Varia por engine:
// NOWEB (Baileys) → _data.pushName; WEBJS → _data.notifyName.
export function nomeDoContato(payload: { _data?: { pushName?: unknown; notifyName?: unknown } }): string | null {
  for (const v of [payload._data?.pushName, payload._data?.notifyName]) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

// Telefone do contato quando `from` é @lid e a consulta de LID no WAHA falha.
// NOWEB (Baileys) manda o número alternativo em _data.key (remoteJidAlt/senderPn).
const JID_TELEFONE = /^(\d{8,15})@(s\.whatsapp\.net|c\.us)$/

export function telefoneAlternativo(payload: { _data?: { key?: Record<string, unknown> } }): string | null {
  const key = payload._data?.key
  if (!key) return null
  for (const campo of ['remoteJidAlt', 'senderPn']) {
    const v = key[campo]
    const m = typeof v === 'string' ? JID_TELEFONE.exec(v) : null
    if (m) return m[1]
  }
  return null
}
