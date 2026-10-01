'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'

import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase-browser'
import { formatCurrency, type SupportedCurrency } from '@/lib/currency'
import { montarCardsEquipe, type CardEquipe, type LinhaMetricas, type UsuarioEquipe } from '@/lib/equipe'

const supabase = createClient()

export default function EquipePage() {
  return (
    <ProtectedRoute>
      <EquipeContent />
    </ProtectedRoute>
  )
}

function EquipeContent() {
  const router = useRouter()
  const { tenant } = useAuth()
  const { startImpersonation } = useAdmin()
  const [cards, setCards] = useState<CardEquipe[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Mês vigente (mesmo critério do Painel: data_mes_venda)
  const periodo = useMemo(() => {
    const hoje = new Date()
    return {
      inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'),
      fim: format(endOfMonth(hoje), 'yyyy-MM-dd'),
      label: format(hoje, "MMMM 'de' yyyy", { locale: ptBR }),
    }
  }, [])

  useEffect(() => {
    if (!tenant?.id) return
    let cancelado = false
    const carregar = async () => {
      setLoading(true)
      setErro(null)
      try {
        const [resUsuarios, { data: linhas, error }] = await Promise.all([
          fetch('/api/empresa/usuarios?ativos=1'),
          // função fora dos tipos gerados (mesmo padrão do dashboard_resumo)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.rpc('dashboard_equipe' as any, { p_inicio: periodo.inicio, p_fim: periodo.fim } as any),
        ])
        if (!resUsuarios.ok) throw new Error('Erro ao carregar equipe')
        if (error) throw error
        const { usuarios } = await resUsuarios.json()
        if (cancelado) return
        setCards(montarCardsEquipe((usuarios ?? []) as UsuarioEquipe[], (linhas ?? []) as LinhaMetricas[]))
      } catch (e) {
        console.error('Erro ao carregar equipe:', e)
        if (!cancelado) setErro('Não foi possível carregar a equipe.')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    void carregar()
    return () => { cancelado = true }
  }, [tenant?.id, periodo])

  const abrir = (c: CardEquipe) => {
    startImpersonation({ id: c.id, email: c.email ?? '', company_name: c.nome, currency: c.currency })
    router.push('/dashboard')
  }

  return (
    <MainLayout>
      <section className="space-y-8">
        <div className="space-y-3">
          <Badge variant="muted" className="w-fit bg-primary/10 text-primary">Equipe</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {tenant?.name ?? 'Minha equipe'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Resultados de cada artista em <span className="capitalize">{periodo.label}</span>. Clique para abrir o painel.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando equipe
          </div>
        ) : erro ? (
          <Card><CardHeader><CardTitle className="text-lg">{erro}</CardTitle></CardHeader></Card>
        ) : cards.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nenhum artista ativo</CardTitle>
              <CardDescription>Convide artistas em Minha empresa.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrir(c)}
                className="rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="truncate text-base">{c.nome}</CardTitle>
                    {c.email && <p className="truncate text-xs text-muted-foreground">{c.email}</p>}
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <Metrica label="Leads" valor={String(c.leads)} />
                    <Metrica label="Vendas" valor={String(c.vendas)} />
                    <Metrica
                      label="Valor vendido"
                      valor={formatCurrency(c.valorVendido, c.currency as SupportedCurrency)}
                    />
                    <Metrica
                      label="Conversão"
                      valor={c.conversao === null ? '—' : `${(c.conversao * 100).toFixed(1).replace('.', ',')}%`}
                    />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>
    </MainLayout>
  )
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-lg font-semibold">{valor}</div>
    </div>
  )
}
