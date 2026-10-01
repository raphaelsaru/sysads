// Cards da home do dono (/equipe): artistas ativos + métricas do período.

export type UsuarioEquipe = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  is_active: boolean
  currency: string
}

// Linha de dashboard_equipe (numeric do Postgres pode vir como string).
export type LinhaMetricas = {
  user_id: string
  leads: number | string
  vendas: number | string
  valor_vendido: number | string
}

export type CardEquipe = {
  id: string
  nome: string
  email: string | null
  currency: string
  leads: number
  vendas: number
  valorVendido: number
  conversao: number | null // vendas / leads; null sem leads
}

export function montarCardsEquipe(usuarios: UsuarioEquipe[], linhas: LinhaMetricas[]): CardEquipe[] {
  const porUsuario = new Map(linhas.map(l => [l.user_id, l]))
  return usuarios
    .filter(u => u.role === 'user' && u.is_active)
    .map(u => {
      const m = porUsuario.get(u.id)
      const leads = Number(m?.leads) || 0
      const vendas = Number(m?.vendas) || 0
      return {
        id: u.id,
        nome: u.full_name ?? u.email ?? 'Sem nome',
        email: u.email,
        currency: u.currency,
        leads,
        vendas,
        valorVendido: Number(m?.valor_vendido) || 0,
        conversao: leads > 0 ? vendas / leads : null,
      }
    })
    .sort((a, b) => b.valorVendido - a.valorVendido || a.nome.localeCompare(b.nome, 'pt-BR'))
}
