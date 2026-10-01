// Nome do contato no payload de mensagem do WAHA. Varia por engine:
// NOWEB (Baileys) → _data.pushName; WEBJS → _data.notifyName.
export function nomeDoContato(payload: { _data?: { pushName?: unknown; notifyName?: unknown } }): string | null {
  for (const v of [payload._data?.pushName, payload._data?.notifyName]) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}
