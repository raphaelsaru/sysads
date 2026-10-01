'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Instagram as InstagramIcon, Loader2, QrCode, Smartphone } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import MetaAdsCard from '@/components/empresa/MetaAdsCard'
import { useAuth } from '@/contexts/AuthContext'
import { pode } from '@/lib/permissions'

type WhatsappStatus =
  | { status: 'loading' }
  | { status: 'not_connected' }
  | { status: 'syncing' }
  | { status: 'qr'; qr: string }
  | { status: 'connected'; phone: string | null }
  | { status: 'failed' }

type InstagramStatus =
  | { status: 'loading' }
  | { status: 'not_connected' }
  | { status: 'connected'; username: string | null; capturar_nao_seguidos: boolean }

function InstagramCard() {
  const [state, setState] = useState<InstagramStatus>({ status: 'loading' })
  const erro = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('instagram_error')

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/instagram/status')
    setState(await res.json())
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function handleCapturarNaoSeguidos(valor: boolean) {
    setState((s) => (s.status === 'connected' ? { ...s, capturar_nao_seguidos: valor } : s))
    const res = await fetch('/api/integrations/instagram/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capturar_nao_seguidos: valor }),
    })
    if (!res.ok) await fetchStatus()
  }

  async function handleDisconnect() {
    setState({ status: 'loading' })
    await fetch('/api/integrations/instagram/disconnect', { method: 'POST' })
    await fetchStatus()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InstagramIcon className="h-5 w-5" />
          Instagram
        </CardTitle>
        <CardDescription>Conecte o Instagram do seu negócio para transformar DMs em leads automaticamente.</CardDescription>
      </CardHeader>
      <CardContent>
        {erro && (
          <p className="mb-3 text-sm text-destructive">Não foi possível conectar o Instagram. Tente novamente.</p>
        )}

        {state.status === 'loading' && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        )}

        {state.status === 'not_connected' && (
          <Button asChild>
            <a href="/api/integrations/instagram/connect">Conectar Instagram</a>
          </Button>
        )}

        {state.status === 'connected' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Conectado{state.username ? ` — @${state.username}` : ''}
            </div>
            <p className="text-sm text-muted-foreground">
              Mensagens vindas de anúncios viram lead automaticamente.
            </p>
            <div className="flex items-start gap-3">
              <Switch
                id="capturar-nao-seguidos"
                checked={state.capturar_nao_seguidos}
                onCheckedChange={handleCapturarNaoSeguidos}
              />
              <Label htmlFor="capturar-nao-seguidos" className="space-y-1 font-normal">
                <span className="block text-sm font-medium">Capturar também quem você não segue</span>
                <span className="block text-sm text-muted-foreground">
                  DMs sem anúncio viram lead só se o seu perfil não segue a pessoa (filtra amigos e família).
                </span>
              </Label>
            </div>
            <Button variant="outline" onClick={handleDisconnect}>
              Desconectar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type UsuarioMeta = { id: string; full_name: string | null; email: string | null }

function IntegrationsPageContent() {
  const { userProfile, tenant } = useAuth()
  const podeMeta = pode(userProfile?.role, 'meta')
  const tenantId = tenant?.id ?? null
  const [usuarios, setUsuarios] = useState<UsuarioMeta[]>([])
  const [state, setState] = useState<WhatsappStatus>({ status: 'loading' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/whatsapp/status')
    const data = await res.json()
    setState(data)
    return data as WhatsappStatus
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus()
      if (data.status === 'connected' || data.status === 'failed') stopPolling()
    }, 3000)
  }, [fetchStatus, stopPolling])

  useEffect(() => {
    fetchStatus().then((data) => {
      if (data.status === 'qr' || data.status === 'syncing') startPolling()
    })
    return stopPolling
  }, [fetchStatus, startPolling, stopPolling])

  // Lista de usuários p/ integração Meta por usuário (só quem gerencia Meta).
  useEffect(() => {
    if (!podeMeta || !tenantId) return
    fetch('/api/empresa/usuarios?ativos=1')
      .then((r) => (r.ok ? r.json() : { usuarios: [] }))
      .then((d) => setUsuarios(d.usuarios || []))
      .catch(() => {})
  }, [podeMeta, tenantId])

  async function handleConnect() {
    setState({ status: 'loading' })
    const res = await fetch('/api/integrations/whatsapp/connect', { method: 'POST' })
    const data = await res.json()
    setState(data)
    if (data.status === 'qr' || data.status === 'syncing') startPolling()
  }

  async function handleDisconnect() {
    setState({ status: 'loading' })
    await fetch('/api/integrations/whatsapp/disconnect', { method: 'POST' })
    stopPolling()
    await fetchStatus()
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {pode(userProfile?.role, 'integracoes') ? 'Integrações' : 'Minhas conexões'}
          </h1>
          <p className="text-muted-foreground">Conecte seus canais para receber leads automaticamente no CRM.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              WhatsApp
            </CardTitle>
            <CardDescription>
              Conecte o WhatsApp do seu negócio para que novas conversas virem leads automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.status === 'loading' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            )}

            {state.status === 'not_connected' && (
              <Button onClick={handleConnect}>Conectar WhatsApp</Button>
            )}

            {state.status === 'failed' && (
              <div className="space-y-3">
                <p className="text-sm text-destructive">Sua conexão caiu. Reconecte para voltar a receber leads.</p>
                <Button onClick={handleConnect}>Reconectar WhatsApp</Button>
              </div>
            )}

            {state.status === 'syncing' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando com o WhatsApp... isso pode levar até 1 minuto.
              </div>
            )}

            {state.status === 'qr' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Abra o WhatsApp no celular do negócio → Configurações → Aparelhos conectados → Conectar aparelho, e
                  escaneie o código abaixo.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.qr} alt="QR code de conexão do WhatsApp" className="h-64 w-64 rounded-lg border" />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <QrCode className="h-3 w-3" />O código expira rápido, atualizamos automaticamente.
                </p>
              </div>
            )}

            {state.status === 'connected' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Conectado{state.phone ? ` — ${state.phone.replace('@c.us', '')}` : ''}
                </div>
                <Button variant="outline" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <InstagramCard />

        {podeMeta && <MetaAdsCard tenantId={tenantId} usuarios={usuarios} />}
      </div>
    </MainLayout>
  )
}

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <IntegrationsPageContent />
    </ProtectedRoute>
  )
}
