'use client'

import { useEffect, useState } from 'react'
import { Loader2, Palette } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Artistas que o vendedor atende (dono marca/desmarca; salva a cada mudança).
export default function ArtistasDoVendedor({ vendedorId, vendedorNome, artistas }: {
  vendedorId: string
  vendedorNome: string
  artistas: { id: string; nome: string }[]
}) {
  const [selecionados, setSelecionados] = useState<string[] | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/empresa/usuarios/${vendedorId}/artistas`)
      .then(res => (res.ok ? res.json() : { artistas: [] }))
      .then(d => { if (!cancelado) setSelecionados(d.artistas ?? []) })
      .catch(() => { if (!cancelado) setSelecionados([]) })
    return () => { cancelado = true }
  }, [vendedorId])

  const alternar = async (artistaId: string, marcado: boolean) => {
    if (!selecionados) return
    const anterior = selecionados
    const proximo = marcado ? [...anterior, artistaId] : anterior.filter(id => id !== artistaId)
    setSelecionados(proximo)
    setSalvando(true)
    try {
      const res = await fetch(`/api/empresa/usuarios/${vendedorId}/artistas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistas: proximo }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao salvar artistas')
      }
    } catch (err) {
      setSelecionados(anterior)
      alert(err instanceof Error ? err.message : 'Erro ao salvar artistas')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={selecionados === null} aria-label={`Artistas atendidos por ${vendedorNome}`}>
          {selecionados === null
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Palette className="mr-2 h-4 w-4" />}
          Artistas ({selecionados?.length ?? 0})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-3 text-sm font-medium">Artistas que {vendedorNome} atende</p>
        {artistas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum artista ativo na empresa.</p>
        ) : (
          <div className="space-y-2">
            {artistas.map(a => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selecionados?.includes(a.id) ?? false}
                  disabled={salvando}
                  onCheckedChange={(v) => { void alternar(a.id, v === true) }}
                />
                <span className="truncate">{a.nome}</span>
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
