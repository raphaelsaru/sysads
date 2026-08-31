'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarCheck, CalendarOff, Loader2 } from 'lucide-react'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Mapping {
  id: string
  full_name: string | null
  role: string
  calendar_id: string | null
  calendar_name: string | null
}

interface GoogleCalendar {
  id: string
  summary: string
}

function GoogleCalendarAdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userProfile } = useAuth()

  const [status, setStatus] = useState<'loading' | 'connected' | 'not_connected'>('loading')
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [pendingSelection, setPendingSelection] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const gcalError = searchParams.get('gcal_error')

  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [userProfile, router])

  const carregarStatus = useCallback(async () => {
    const res = await fetch('/api/google-calendar/status', { credentials: 'include' })
    const data = await res.json()
    if (data.status === 'connected') {
      setStatus('connected')
      setConnectedEmail(data.email)
    } else {
      setStatus('not_connected')
    }
  }, [])

  const carregarMappings = useCallback(async () => {
    const res = await fetch('/api/google-calendar/mappings', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setMappings(data.mappings ?? [])
    }
  }, [])

  const carregarCalendars = useCallback(async () => {
    const res = await fetch('/api/google-calendar/calendars', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setCalendars(data.calendars ?? [])
    }
  }, [])

  useEffect(() => {
    if (userProfile?.role !== 'admin') return
    carregarStatus()
    carregarMappings()
  }, [userProfile, carregarStatus, carregarMappings])

  useEffect(() => {
    if (status === 'connected') carregarCalendars()
  }, [status, carregarCalendars])

  const salvarMapeamento = async (userId: string) => {
    const calendarId = pendingSelection[userId]
    if (!calendarId) return
    setSaving(userId)
    try {
      const calendar = calendars.find((c) => c.id === calendarId)
      await fetch('/api/google-calendar/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, calendarId, calendarName: calendar?.summary }),
      })
      await carregarMappings()
    } finally {
      setSaving(null)
    }
  }

  if (userProfile?.role !== 'admin') return null

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <Badge variant="muted" className="mb-3 w-fit bg-primary/10 text-primary">
            Administração
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Google Calendar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Conecte sua conta Google e associe a agenda de cada tatuador.
          </p>
        </div>

        {gcalError === 'no_refresh_token' && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            O Google não retornou permissão de renovação. Revogue o acesso em{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline">
              myaccount.google.com/permissions
            </a>{' '}
            e tente conectar novamente.
          </div>
        )}
        {gcalError === '1' && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Não foi possível conectar ao Google Calendar. Tente novamente.
          </div>
        )}

        <Card className="border-border/70 bg-card/70 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {status === 'connected' ? (
                <CalendarCheck className="h-5 w-5 text-primary" />
              ) : (
                <CalendarOff className="h-5 w-5 text-muted-foreground" />
              )}
              Conexão com Google
            </CardTitle>
            <CardDescription>
              {status === 'loading' && 'Verificando…'}
              {status === 'connected' && `Conectado como ${connectedEmail}`}
              {status === 'not_connected' && 'Nenhuma conta Google conectada ainda.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/google-calendar/auth">
                {status === 'connected' ? 'Reconectar' : 'Conectar Google Calendar'}
              </a>
            </Button>
          </CardContent>
        </Card>

        {status === 'connected' && (
          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de agendas</CardTitle>
              <CardDescription>Associe cada tatuador à agenda do Google correspondente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tatuador</TableHead>
                    <TableHead>Agenda atual</TableHead>
                    <TableHead>Nova agenda</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name || 'Sem nome'}</TableCell>
                      <TableCell>{m.calendar_name || m.calendar_id || '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={pendingSelection[m.id]}
                          onValueChange={(value) => setPendingSelection((prev) => ({ ...prev, [m.id]: value }))}
                        >
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Selecione uma agenda" />
                          </SelectTrigger>
                          <SelectContent>
                            {calendars.map((cal) => (
                              <SelectItem key={cal.id} value={cal.id}>{cal.summary}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={!pendingSelection[m.id] || saving === m.id}
                          onClick={() => salvarMapeamento(m.id)}
                        >
                          {saving === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}

export default function GoogleCalendarAdminPage() {
  return (
    <ProtectedRoute>
      <GoogleCalendarAdminContent />
    </ProtectedRoute>
  )
}
