import { useState, useEffect } from 'react'

interface Quote {
  q: string
  a: string
  h: string
  timestamp: number
}

// Função para verificar se a citação é do dia atual
const isQuoteFromToday = (timestamp: number): boolean => {
  const today = new Date().toDateString()
  const quoteDate = new Date(timestamp).toDateString()
  return today === quoteDate
}

// Função para obter citação do localStorage
const getCachedQuote = (): Quote | null => {
  try {
    const cached = localStorage.getItem('daily-quote')
    if (cached) {
      const quote: Quote = JSON.parse(cached)
      if (isQuoteFromToday(quote.timestamp)) {
        return quote
      }
    }
  } catch (error) {
    console.warn('Erro ao ler cache local:', error)
  }
  return null
}

// Função para salvar citação no localStorage
const setCachedQuote = (quote: Quote): void => {
  try {
    localStorage.setItem('daily-quote', JSON.stringify(quote))
  } catch (error) {
    console.warn('Erro ao salvar cache local:', error)
  }
}

export function useDailyQuote() {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Primeiro, verifica se já temos uma citação do dia no cache local
        const cachedQuote = getCachedQuote()
        if (cachedQuote) {
          setQuote(cachedQuote)
          setLoading(false)
          return
        }
        
        const response = await fetch('/api/quote')
        
        if (!response.ok) {
          throw new Error('Falha ao buscar citação')
        }
        
        const data: Quote = await response.json()
        setQuote(data)
        setCachedQuote(data)
      } catch (err) {
        console.error('Erro ao buscar citação:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        
        // Fallback para uma citação padrão em caso de erro
        const fallbackQuote: Quote = {
          q: "Centralize oportunidades, acompanhe negociações e ofereça experiências marcantes em cada contato.",
          a: "Prizely CRM",
          h: "",
          timestamp: Date.now()
        }
        setQuote(fallbackQuote)
        setCachedQuote(fallbackQuote)
      } finally {
        setLoading(false)
      }
    }

    fetchQuote()
  }, [])

  return { quote, loading, error }
}
