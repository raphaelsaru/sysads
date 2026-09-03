// Agregados calculados a partir de uma lista de negociações. Usado tanto em
// GET /api/clientes/[id] (dados vindos direto do banco) quanto em
// /leads/[id] (estado local, tipo Negociacao de crm.ts) — tipo de entrada é
// estrutural (só os campos usados) pra servir os dois sem reshape.

export interface NegociacaoParaAgregado {
  resultado: string;
  valorFechado?: string | number | null;
}

/** Soma valorFechado das negociações com resultado === 'Venda'. */
export function calcularLtv(negociacoes: NegociacaoParaAgregado[]): number {
  return negociacoes.reduce((soma, n) => {
    if (n.resultado !== 'Venda') return soma;
    const valor = n.valorFechado ? Number(n.valorFechado) : 0;
    return soma + (Number.isFinite(valor) ? valor : 0);
  }, 0);
}

/** Conta negociações com resultado === 'Venda'. */
export function calcularTotalVendas(negociacoes: NegociacaoParaAgregado[]): number {
  return negociacoes.filter((n) => n.resultado === 'Venda').length;
}
