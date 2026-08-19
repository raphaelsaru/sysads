const WAHA_API_URL = process.env.WAHA_API_URL
const WAHA_API_KEY = process.env.WAHA_API_KEY

export interface WahaSession {
  name: string
  status: 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'STOPPED' | string
  me: { id: string; pushName?: string } | null
}

function assertConfigured(): void {
  if (!WAHA_API_URL || !WAHA_API_KEY) {
    throw new Error('WAHA_API_URL/WAHA_API_KEY não configurados')
  }
}

async function wahaFetch(path: string, init?: RequestInit): Promise<Response> {
  assertConfigured()
  const res = await fetch(`${WAHA_API_URL}${path}`, {
    ...init,
    headers: { 'X-Api-Key': WAHA_API_KEY!, 'Content-Type': 'application/json', ...init?.headers },
  })
  return res
}

export function webhookConfig() {
  return {
    webhooks: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.prizely.com.br'}/api/webhooks/waha`,
        events: ['message'],
        customHeaders: [{ name: 'X-Waha-Secret', value: process.env.WAHA_WEBHOOK_SECRET ?? '' }],
      },
    ],
  }
}

export async function createSession(sessionName: string): Promise<WahaSession> {
  const res = await wahaFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ name: sessionName, start: true, config: webhookConfig() }),
  })
  if (!res.ok) throw new Error(`Falha ao criar sessão WAHA: ${res.status}`)
  return res.json()
}

export async function restartSession(sessionName: string): Promise<void> {
  await wahaFetch(`/api/sessions/${sessionName}/stop`, { method: 'POST' })
  const res = await wahaFetch(`/api/sessions/${sessionName}/start`, { method: 'POST' })
  if (!res.ok) throw new Error(`Falha ao reiniciar sessão WAHA: ${res.status}`)
}

export async function getSession(sessionName: string): Promise<WahaSession | null> {
  const res = await wahaFetch(`/api/sessions/${sessionName}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Falha ao consultar sessão WAHA: ${res.status}`)
  return res.json()
}

export async function getQrCodeDataUrl(sessionName: string): Promise<string> {
  const res = await wahaFetch(`/api/${sessionName}/auth/qr`)
  if (!res.ok) throw new Error(`Falha ao obter QR code: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  return `data:image/png;base64,${buffer.toString('base64')}`
}

export async function sendText(sessionName: string, chatId: string, text: string): Promise<void> {
  const res = await wahaFetch('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({ session: sessionName, chatId, text }),
  })
  if (!res.ok) throw new Error(`Falha ao enviar mensagem WAHA: ${res.status}`)
}

export async function logoutSession(sessionName: string): Promise<void> {
  const res = await wahaFetch(`/api/sessions/${sessionName}/logout`, { method: 'POST' })
  if (!res.ok && res.status !== 404) throw new Error(`Falha ao desconectar sessão WAHA: ${res.status}`)
}
