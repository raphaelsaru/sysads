// Texto legível dos eventos de audit_log (tela /logs). Puro: sem acesso ao banco.
import { formatCurrency } from '@/lib/currency'
import { roleLabel } from '@/lib/roles'
import type { UserRole } from '@/types/crm'

export type EventoAuditoria = {
  tabela: string
  operacao: 'INSERT' | 'UPDATE' | 'DELETE'
  rotulo: string | null
  // UPDATE: { campo: [antes, depois] }; INSERT/DELETE: { campo: valor }
  mudancas: Record<string, unknown>
}

const ROTULOS: Record<string, string> = {
  nome: 'Nome', whatsapp_instagram: 'WhatsApp/Instagram', email: 'E-mail', origem: 'Origem',
  observacao: 'Observação', categoria: 'Categoria', user_id: 'Responsável', data_contato: 'Data de contato',
  resultado: 'Resultado', valor_fechado: 'Valor', orcamento_enviado: 'Orçamento enviado',
  qualidade_contato: 'Qualidade', nao_respondeu: 'Não respondeu', pagou_sinal: 'Pagou sinal',
  valor_sinal: 'Valor do sinal', data_pagamento_sinal: 'Data do sinal', venda_paga: 'Venda paga',
  data_pagamento_venda: 'Data do pagamento', data_lembrete_chamada: 'Lembrete', respondeu: 'Respondeu',
  procedimento: 'Procedimento', motivo_nao_venda: 'Motivo não venda', forma_pagamento_sinal: 'Forma de pgto do sinal',
  role: 'Papel', is_active: 'Ativo', full_name: 'Nome', name: 'Nome', branding: 'Cores', max_users: 'Vagas',
}

const MOEDA = new Set(['valor_fechado', 'valor_sinal'])
const DATA = /^\d{4}-\d{2}-\d{2}$/
const MAX_TEXTO = 80

// Campos que só identificam o vínculo (já no rótulo)
const OCULTOS = new Set(['artista_id'])

function formatar(campo: string, valor: unknown, nomes: Record<string, string>): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (MOEDA.has(campo)) return formatCurrency(Number(valor), 'BRL').replace(/ /g, ' ')
  if (campo === 'role') return roleLabel[valor as UserRole] ?? String(valor)
  if (campo === 'user_id') return nomes[String(valor)] ?? 'outro usuário'
  if (campo === 'branding') return 'alterada'
  if (typeof valor === 'string' && DATA.test(valor)) {
    const [a, m, d] = valor.split('-')
    return `${d}/${m}/${a}`
  }
  const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  return texto.length > MAX_TEXTO ? `${texto.slice(0, MAX_TEXTO)}…` : texto
}

function detalhes(e: EventoAuditoria, nomes: Record<string, string>): string[] {
  if (e.operacao === 'DELETE' || e.mudancas.restaurado === true) return []
  return Object.entries(e.mudancas)
    .filter(([campo]) => !OCULTOS.has(campo))
    .map(([campo, valor]) => {
      const rotulo = ROTULOS[campo] ?? campo
      if (campo === 'branding') return `${rotulo}: alterada`
      if (e.operacao === 'UPDATE' && Array.isArray(valor) && valor.length === 2) {
        return `${rotulo}: ${formatar(campo, valor[0], nomes)} → ${formatar(campo, valor[1], nomes)}`
      }
      return `${rotulo}: ${formatar(campo, valor, nomes)}`
    })
}

const OBJETO: Record<string, string> = {
  clientes: 'o lead', negociacoes: 'uma negociação de', follow_ups: 'um follow-up de',
}

function titulo(e: EventoAuditoria): string {
  const r = e.rotulo ?? '(sem nome)'
  const op = e.operacao
  // Lixeira: restauração (superadmin) e exclusão definitiva
  if (OBJETO[e.tabela] && op === 'UPDATE' && e.mudancas.restaurado === true) return `restaurou ${OBJETO[e.tabela]} ${r}`
  if (OBJETO[e.tabela] && op === 'DELETE' && e.mudancas.definitivo === true) return `excluiu definitivamente ${OBJETO[e.tabela]} ${r}`
  switch (e.tabela) {
    case 'clientes':
      return { INSERT: `criou o lead ${r}`, UPDATE: `editou o lead ${r}`, DELETE: `excluiu o lead ${r}` }[op]
    case 'negociacoes':
      return { INSERT: `criou uma negociação de ${r}`, UPDATE: `editou a negociação de ${r}`, DELETE: `excluiu uma negociação de ${r}` }[op]
    case 'follow_ups':
      return { INSERT: `registrou um follow-up de ${r}`, UPDATE: `editou um follow-up de ${r}`, DELETE: `excluiu um follow-up de ${r}` }[op]
    case 'user_profiles': {
      const chaves = Object.keys(e.mudancas)
      const ativo = e.mudancas.is_active
      if (op === 'UPDATE' && chaves.length === 1 && Array.isArray(ativo)) {
        return ativo[1] ? `reativou o usuário ${r}` : `desativou o usuário ${r}`
      }
      return { INSERT: `adicionou ${r} à equipe`, UPDATE: `alterou o usuário ${r}`, DELETE: `removeu ${r} da equipe` }[op]
    }
    case 'tenants':
      return op === 'INSERT' ? `criou a empresa ${r}` : `alterou os dados da empresa ${r}`
    case 'vendedor_artistas':
      return op === 'DELETE' ? `desvinculou vendedor e artista: ${r}` : `vinculou vendedor e artista: ${r}`
    case 'tenant_owners':
      return op === 'DELETE' ? `removeu ${r} como dono` : `adicionou ${r} como dono`
    default:
      return `alterou ${e.tabela}`
  }
}

// `nomes`: userId → nome (p/ campo Responsável)
export function descreverEvento(
  e: EventoAuditoria, nomes: Record<string, string> = {},
): { titulo: string; detalhes: string[] } {
  return { titulo: titulo(e), detalhes: detalhes(e, nomes) }
}
