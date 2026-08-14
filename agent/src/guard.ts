// Filtro de entrada. PRIMEIRA linha, não a principal.
//
// A defesa real é estrutural: nenhuma tool aceita user_id, o escopo vem do
// token verificado, o SQL é parametrizado e o papel do banco é SELECT-only.
// Nenhuma frase muda isso. Este arquivo só evita gastar token com lixo óbvio
// e devolve uma recusa rápida e educada.
//
// CRITÉRIO PARA UM PADRÃO EXISTIR AQUI: a resposta de recusa precisa ser
// VERDADEIRA para toda entrada que ele casa. Um padrão que responde "só tenho
// acesso de leitura" para "quantos clientes cadastrei em julho?" está mentindo
// sobre uma pergunta perfeitamente respondível — isso é o produto parecendo
// quebrado, não segurança. Foi por isso que a lista genérica de verbos de
// escrita (atualizar/alterar/inserir/cadastrar) não está aqui.

export type Checagem =
  | { ok: true }
  | { ok: false; motivo: string; resposta: string }

const MAX_CHARS = 2000

const PADROES: Array<{ re: RegExp; motivo: string; resposta: string }> = [
  {
    re: /\b(ignore|esque[cç]a|desconsidere)\b.{0,30}\b(instru[çc][õo]es|regras|prompt|acima|anterior)/i,
    motivo: 'tentativa de override de instruções',
    resposta: 'Só consigo responder perguntas sobre os seus dados do CRM.',
  },
  {
    re: /\b(system prompt|prompt do sistema|suas instru[çc][õo]es|instru[çc][õo]es iniciais|voc[êe] foi programad)/i,
    motivo: 'pedido de system prompt',
    resposta: 'Não compartilho minha configuração interna. Posso ajudar com seus números do CRM.',
  },
  {
    // Só o pedido de escrita INEQUÍVOCO: verbo destrutivo no imperativo/infinitivo
    // seguido do objeto. "quantos leads eu apaguei" e "pedi pra remover da lista"
    // não casam — são perguntas sobre o histórico, e são respondíveis.
    re: /\b(apag(?:ue|ar)|delet(?:e|ar)|remov(?:a|er)|exclu(?:a|ir))\s+(?:o|a|os|as|esse|essa|este|esta|aquele|aquela|meu|minha|todos|todas)?\s*(lead|leads|cliente|clientes|contato|contatos|registro|registros|venda|vendas)\b/i,
    motivo: 'tentativa de escrita',
    resposta:
      'Só tenho acesso de leitura. Consigo analisar seus dados, mas não alterá-los — use as telas do CRM pra isso.',
  },
  {
    re: /\b(outro usu[áa]rio|outros usu[áa]rios|todos os usu[áa]rios|dados d[oa]s? (outr|demais))/i,
    motivo: 'tentativa de acesso a outro escopo',
    resposta: 'Só consigo ver os dados da conta em uso no momento.',
  },
]

// NFKC + remoção de zero-width + colapso de espaço. Não é anti-homóglifo: quem
// contorna isso não ganha nada, porque o guard não é a fronteira de segurança.
// Serve para texto colado do WhatsApp (NBSP, zero-width joiner) não quebrar os
// \b nem passar por "não vazio" sendo só espaço invisível.
function normalizar(s: string): string {
  return s
    .normalize('NFKC')
    // Escapes explícitos: literais invisíveis no código são invisíveis no code review.
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function checarEntrada(pergunta: string): Checagem {
  if (typeof pergunta !== 'string') {
    return {
      ok: false,
      motivo: 'entrada vazia',
      resposta: 'Não recebi nenhuma pergunta. O que você quer saber sobre seus dados?',
    }
  }

  // Tamanho no texto CRU: normalizar encolhe, e o custo de token é do cru.
  if (pergunta.length > MAX_CHARS) {
    return {
      ok: false,
      motivo: 'entrada longa demais',
      resposta: 'Sua mensagem ficou longa demais. Pode resumir a pergunta em uma ou duas frases?',
    }
  }

  const limpa = normalizar(pergunta)
  if (limpa === '') {
    return {
      ok: false,
      motivo: 'entrada vazia',
      resposta: 'Não recebi nenhuma pergunta. O que você quer saber sobre seus dados?',
    }
  }

  for (const p of PADROES) {
    if (p.re.test(limpa)) return { ok: false, motivo: p.motivo, resposta: p.resposta }
  }

  return { ok: true }
}
