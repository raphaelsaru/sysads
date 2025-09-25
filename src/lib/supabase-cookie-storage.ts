// Implementação customizada de storage que força o uso de cookies

export class CookieStorage {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    
    // Tentar pegar do cookie primeiro
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === key) {
        return decodeURIComponent(value)
      }
    }
    
    // Fallback para localStorage
    return localStorage.getItem(key)
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return
    
    // Salvar no cookie E no localStorage
    const expires = new Date()
    expires.setDate(expires.getDate() + 30) // 30 dias
    
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
    
    // Backup no localStorage
    localStorage.setItem(key, value)
    
    console.log('🍪 Token salvo no cookie:', key)
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return
    
    // Remover do cookie
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
    
    // Remover do localStorage
    localStorage.removeItem(key)
    
    console.log('🗑️ Token removido:', key)
  }
}
