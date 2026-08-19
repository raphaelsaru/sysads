import crypto from 'crypto'

const APP_ID = process.env.INSTAGRAM_APP_ID
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.prizely.com.br'}/api/integrations/instagram/callback`
const SCOPES = 'instagram_business_basic,instagram_business_manage_messages'

function assertConfigured(): void {
  if (!APP_ID || !APP_SECRET) {
    throw new Error('INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET não configurados')
  }
}

function appSecretProof(accessToken: string): string {
  return crypto.createHmac('sha256', APP_SECRET!).update(accessToken).digest('hex')
}

export function authorizeUrl(state: string): string {
  assertConfigured()
  const params = new URLSearchParams({
    client_id: APP_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
  })
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; user_id: string }> {
  assertConfigured()
  const form = new URLSearchParams({
    client_id: APP_ID!,
    client_secret: APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  })
  const res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Falha ao trocar code por token: ${res.status}`)
  return res.json()
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in: number }> {
  assertConfigured()
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: APP_SECRET!,
    access_token: shortLivedToken,
  })
  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`)
  if (!res.ok) throw new Error(`Falha ao gerar token de longa duração: ${res.status}`)
  return res.json()
}

export async function getProfile(accessToken: string): Promise<{ user_id: string; username: string }> {
  const params = new URLSearchParams({
    fields: 'user_id,username',
    access_token: accessToken,
    appsecret_proof: appSecretProof(accessToken),
  })
  const res = await fetch(`https://graph.instagram.com/v21.0/me?${params.toString()}`)
  if (!res.ok) throw new Error(`Falha ao buscar perfil do Instagram: ${res.status}`)
  return res.json()
}

export async function getSenderUsername(senderId: string, accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    fields: 'username',
    access_token: accessToken,
    appsecret_proof: appSecretProof(accessToken),
  })
  try {
    const res = await fetch(`https://graph.instagram.com/v21.0/${senderId}?${params.toString()}`)
    if (!res.ok) return null
    const data = (await res.json()) as { username?: string }
    return data.username ?? null
  } catch {
    return null
  }
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET || !signatureHeader?.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')
  const provided = signatureHeader.slice('sha256='.length)
  if (expected.length !== provided.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}
