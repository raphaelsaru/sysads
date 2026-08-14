'use client'

import { Fragment, ReactNode } from 'react'

/**
 * Renderizador de markdown mínimo e proposital — o projeto não tem lib de
 * markdown e não vale a pena adicionar uma só para isso.
 *
 * Suporta apenas o que o assistente realmente produz:
 *   **negrito**, *itálico*, `código`, listas (-, *, 1.), tabelas GFM,
 *   parágrafos e quebras de linha.
 * Não suporta: links, imagens, títulos (#), citações, blocos de código
 * cercados, HTML embutido, aninhamento de listas. Qualquer outra sintaxe
 * aparece como texto literal — nunca como HTML (nada de dangerouslySetInnerHTML).
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

function inline(texto: string, chave: string): ReactNode {
  const partes = texto.split(INLINE).filter((p) => p !== '')
  return (
    <Fragment key={chave}>
      {partes.map((parte, i) => {
        const k = `${chave}-${i}`
        if (parte.startsWith('**') && parte.endsWith('**')) {
          return <strong key={k} className="font-semibold text-foreground">{parte.slice(2, -2)}</strong>
        }
        if (parte.startsWith('`') && parte.endsWith('`')) {
          return (
            <code key={k} className="rounded bg-muted/70 px-1 py-0.5 font-mono text-[0.85em]">
              {parte.slice(1, -1)}
            </code>
          )
        }
        if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
          return <em key={k}>{parte.slice(1, -1)}</em>
        }
        return <Fragment key={k}>{parte}</Fragment>
      })}
    </Fragment>
  )
}

const LINHA_TABELA = /^\s*\|.*\|\s*$/
const SEPARADOR_TABELA = /^\s*\|[\s:|-]+\|\s*$/
const BULLET = /^\s*[-*]\s+(.*)$/
const NUMERADO = /^\s*(\d+)[.)]\s+(.*)$/

function celulas(linha: string): string[] {
  return linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

export default function Markdown({ texto }: { texto: string }) {
  const linhas = texto.split('\n')
  const blocos: ReactNode[] = []
  let i = 0

  while (i < linhas.length) {
    const linha = linhas[i]

    // Tabela: cabeçalho + separador + corpo
    if (LINHA_TABELA.test(linha) && i + 1 < linhas.length && SEPARADOR_TABELA.test(linhas[i + 1])) {
      const cabecalho = celulas(linha)
      i += 2
      const corpo: string[][] = []
      while (i < linhas.length && LINHA_TABELA.test(linhas[i])) {
        corpo.push(celulas(linhas[i]))
        i++
      }
      blocos.push(
        <div key={`t-${i}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                {cabecalho.map((c, ci) => (
                  <th key={ci} className="px-2 py-1 text-left font-semibold text-foreground">
                    {inline(c, `th-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((linhaCorpo, ri) => (
                <tr key={ri} className="border-b border-border/50 last:border-0">
                  {linhaCorpo.map((c, ci) => (
                    <td key={ci} className="px-2 py-1 align-top">
                      {inline(c, `td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Lista com marcadores
    if (BULLET.test(linha)) {
      const itens: string[] = []
      while (i < linhas.length) {
        const m = linhas[i].match(BULLET)
        if (!m) break
        itens.push(m[1])
        i++
      }
      blocos.push(
        <ul key={`ul-${i}`} className="my-1.5 list-disc space-y-0.5 pl-5">
          {itens.map((item, ii) => (
            <li key={ii}>{inline(item, `li-${i}-${ii}`)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Lista numerada
    if (NUMERADO.test(linha)) {
      const itens: string[] = []
      const inicio = Number(linha.match(NUMERADO)![1]) || 1
      while (i < linhas.length) {
        const m = linhas[i].match(NUMERADO)
        if (!m) break
        itens.push(m[2])
        i++
      }
      blocos.push(
        <ol key={`ol-${i}`} start={inicio} className="my-1.5 list-decimal space-y-0.5 pl-5">
          {itens.map((item, ii) => (
            <li key={ii}>{inline(item, `oli-${i}-${ii}`)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Parágrafo (linhas seguidas viram quebras)
    if (linha.trim() === '') {
      i++
      continue
    }
    const paragrafo: string[] = []
    while (
      i < linhas.length &&
      linhas[i].trim() !== '' &&
      !BULLET.test(linhas[i]) &&
      !NUMERADO.test(linhas[i]) &&
      !LINHA_TABELA.test(linhas[i])
    ) {
      paragrafo.push(linhas[i])
      i++
    }
    blocos.push(
      <p key={`p-${i}`} className="my-1.5 first:mt-0 last:mb-0">
        {paragrafo.map((l, li) => (
          <Fragment key={li}>
            {li > 0 && <br />}
            {inline(l, `pl-${i}-${li}`)}
          </Fragment>
        ))}
      </p>
    )
  }

  return <div className="text-sm leading-relaxed text-foreground">{blocos}</div>
}
