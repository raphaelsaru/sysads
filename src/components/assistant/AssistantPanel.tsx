'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Eye, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react'

import { useAdmin } from '@/contexts/AdminContext'
import { useAssistant, type ToolChamada } from '@/hooks/useAssistant'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Markdown from './Markdown'

const SUGESTOES = ['Resumo do mês', 'Comparar com mês passado', 'Leads sem resposta']

function periodo(args?: Record<string, unknown>): string | null {
  if (!args) return null
  const de = typeof args.de === 'string' ? args.de : null
  const ate = typeof args.ate === 'string' ? args.ate : null
  if (de && ate) return `${de} → ${ate}`
  return de || ate
}

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/**
 * Rodapé de proveniência: mostra QUAIS ferramentas rodaram, com que período e
 * — importante — os VALORES que voltaram. O gate anti-alucinação só pega
 * respostas totalmente inventadas, então o usuário precisa poder conferir os
 * números crus por trás de qualquer figura citada no texto.
 */
function Proveniencia({ tools }: { tools: ToolChamada[] }) {
  const truncado = tools.some((t) => t.truncado)
  const falhou = tools.some((t) => t.ok === false)

  return (
    <details className="group mt-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none list-none text-muted-foreground transition-colors hover:text-foreground">
        <span className="font-medium">Dados usados</span>
        <span className="ml-1">({tools.length} {tools.length === 1 ? 'consulta' : 'consultas'})</span>
        {truncado && <span className="ml-2 text-amber-600 dark:text-amber-400">pode haver mais</span>}
        {falhou && <span className="ml-2 text-destructive">consulta com erro</span>}
      </summary>

      <div className="mt-2 space-y-3">
        {tools.map((t, i) => {
          const per = periodo(t.args)
          const linhasDados = t.dados ?? []
          return (
            <div key={i} className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <code className="font-mono font-medium text-foreground">{t.tool}</code>
                {per && <span className="text-muted-foreground">{per}</span>}
                {typeof t.linhas === 'number' && (
                  <span className="text-muted-foreground">
                    {t.linhas} {t.linhas === 1 ? 'linha' : 'linhas'}
                  </span>
                )}
                {t.janela && <span className="text-muted-foreground">janela: {t.janela}</span>}
                {t.ok === false && <span className="text-destructive">falhou</span>}
                {t.truncado && (
                  <span className="text-amber-600 dark:text-amber-400">truncado — pode haver mais</span>
                )}
              </div>

              {t.erro && <div className="text-destructive">{t.erro}</div>}

              {linhasDados.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        {Object.keys(linhasDados[0]).map((col) => (
                          <th key={col} className="px-2 py-1 text-left font-medium text-muted-foreground">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasDados.map((linha, li) => (
                        <tr key={li} className="border-b border-border/40 last:border-0">
                          {Object.keys(linhasDados[0]).map((col) => (
                            <td key={col} className="whitespace-nowrap px-2 py-1 text-foreground">
                              {valorLegivel(linha[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                t.ok !== false && <div className="text-muted-foreground">nenhum dado retornado</div>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}

export default function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { impersonatedUser } = useAdmin()
  const { mensagens, enviando, erro, enviar, limpar } = useAssistant()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens, enviando])

  const submeter = () => {
    const valor = inputRef.current?.value ?? ''
    if (!valor.trim() || enviando) return
    void enviar(valor)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (!open) return null

  return (
    // Sem overlay: o painel flutua ao lado, a tabela atrás continua utilizável.
    <aside
      role="dialog"
      aria-label="Assistente Prizely"
      className="glass-floating fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col rounded-none sm:bottom-4 sm:right-4 sm:top-4 sm:w-[420px] sm:rounded-2xl"
    >
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="flex-1 text-sm font-semibold text-foreground">Assistente</h2>
        {mensagens.length > 0 && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={limpar} aria-label="Limpar conversa">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Fechar assistente">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {impersonatedUser && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>
            Vendo como: <strong>{impersonatedUser.company_name || impersonatedUser.email}</strong>
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite" aria-busy={enviando}>
        {mensagens.length === 0 && !enviando ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Pergunte sobre seus dados</p>
              <p className="text-xs text-muted-foreground">
                Leads, vendas e faturamento do seu CRM. Cada pergunta é independente — inclua o
                período que você quer.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void enviar(s)}
                  className="glass-control rounded-full px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {mensagens.map((m) =>
              m.papel === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.texto}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="max-w-full">
                  <Markdown texto={m.texto} />
                  {m.tools && m.tools.length > 0 && <Proveniencia tools={m.tools} />}
                </div>
              )
            )}
            {enviando && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Consultando seus dados…
              </div>
            )}
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {erro && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            rows={1}
            placeholder="Ex.: quantos leads em julho?"
            disabled={enviando}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submeter()
              }
            }}
            className="max-h-32 min-h-[42px] flex-1 resize-none py-2.5"
          />
          <Button size="icon" onClick={submeter} disabled={enviando} aria-label="Enviar pergunta">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </aside>
  )
}
