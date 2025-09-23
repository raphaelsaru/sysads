import { NextResponse } from 'next/server'

interface Quote {
  q: string
  a: string
  h: string
  timestamp: number
}

// Cache da citação do dia
let dailyQuote: Quote | null = null
let lastFetchDate: string | null = null

export async function GET() {
  const today = new Date().toDateString()
  
  // Se já temos uma citação de hoje, retorna ela
  if (dailyQuote && lastFetchDate === today) {
    return NextResponse.json(dailyQuote)
  }
  try {
    const response = await fetch('https://zenquotes.io/api/random', {
      headers: {
        'User-Agent': 'Prizely-CRM/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: Quote[] = await response.json()

    if (!data || data.length === 0) {
      throw new Error('Nenhuma citação encontrada')
    }

    // Cria a citação com timestamp
    const newQuote: Quote = {
      ...data[0],
      timestamp: Date.now()
    }

    // Atualiza o cache
    dailyQuote = newQuote
    lastFetchDate = today

    return NextResponse.json(newQuote)
  } catch (error) {
    console.error('Erro ao buscar citação:', error)
    
    // Retorna uma citação padrão em caso de erro
    const fallbackQuote: Quote = {
      q: "Centralize oportunidades, acompanhe negociações e ofereça experiências marcantes em cada contato.",
      a: "Prizely CRM",
      h: "",
      timestamp: Date.now()
    }

    // Atualiza o cache mesmo com fallback
    dailyQuote = fallbackQuote
    lastFetchDate = today

    return NextResponse.json(fallbackQuote)
  }
}
