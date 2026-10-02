'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase-browser'
import { formatCurrency, type SupportedCurrency } from '@/lib/currency'
import { montarCardsEquipe, type CardEquipe, type LinhaMetricas, type UsuarioEquipe } from '@/lib/equipe'

const supabase = createClient()

// Cards de artistas c/ métricas do mês; clique = "Visualizar como" + `destino`.
// Usado na home do dono (/equipe) e na escolha de artista do vendedor (/atendimento).
export default function CardsArtistas({ fonte, destino, selo, descricao, vazio, entrarSeUnico = false }: {
  fonte: string            // endpoint que lista os artistas ({ usuarios } ou { artistas })
  destino: string          // rota aberta após escolher o artista
  selo: string
  descricao: string
  vazio: { titulo: string; texto: string }
  entrarSeUnico?: boolean  // um único artista: entra direto
}) {
  const router = useRouter()
  const { tenant } = useAuth()
  const { startImpersonation } = useAdmin()
  const [cards, setCards] = useState<CardEquipe[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const entrouAuto = useRef(false)

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
        const [res, { data: linhas, error }] = await Promise.all([
          fetch(fonte),
          // função fora dos tipos gerados (mesmo padrão do dashboard_resumo)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.rpc('dashboard_equipe' as any, { p_inicio: periodo.inicio, p_fim: periodo.fim } as any),
        ])
        if (!res.ok) throw new Error('Erro ao carregar artistas')
        if (error) throw error
        const body = await res.json()
        if (cancelado) return
        const usuarios = (body.usuarios ?? body.artistas ?? []) as UsuarioEquipe[]
        setCards(montarCardsEquipe(usuarios, (linhas ?? []) as LinhaMetricas[]))
      } catch (e) {
        console.error('Erro ao carregar artistas:', e)
        if (!cancelado) setErro('Não foi possível carregar os artistas.')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    void carregar()
    return () => { cancelado = true }
  }, [tenant?.id, periodo, fonte])

  const abrir = (c: CardEquipe) => {
    startImpersonation({ id: c.id, email: c.email ?? '', company_name: c.nome, currency: c.currency })
    router.push(destino as never)
  }

  useEffect(() => {
    if (entrarSeUnico && !loading && cards.length === 1 && !entrouAuto.current) {
      entrouAuto.current = true
      abrir(cards[0])
    }
    // abrir é estável o suficiente; só reage ao carregamento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrarSeUnico, loading, cards])

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Badge variant="muted" className="w-fit bg-primary/10 text-primary">{selo}</Badge>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {tenant?.name ?? 'Prizely'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {descricao} Métricas de <span className="capitalize">{periodo.label}</span>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando artistas
        </div>
      ) : erro ? (
        <Card><CardHeader><CardTitle className="text-lg">{erro}</CardTitle></CardHeader></Card>
      ) : cards.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{vazio.titulo}</CardTitle>
            <CardDescription>{vazio.texto}</CardDescription>
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
