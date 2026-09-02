/**
 * Normalização de telefone e Instagram — espelha as funções SQL
 * `public.normalizar_telefone` e `public.normalizar_instagram` (Postgres).
 *
 * Usado no client (detecção de duplicidade na importação por OCR, e
 * qualquer pré-checagem client-side antes de enviar um formulário) onde
 * não é possível chamar o banco. Deve se comportar identicamente às
 * funções SQL para a mesma entrada.
 *
 * ATENÇÃO: se as funções SQL mudarem, atualize este arquivo também.
 */

const INSTAGRAM_DENYLIST = new Set([
  "seminsta",
  "sem_insta",
  "naotem",
  "nao_tem",
  "semcontato",
  "sem_contato",
  "naotemsinstagram",
  "sn",
]);

/**
 * Espelha `public.normalizar_telefone(text)`:
 * - null/undefined -> null
 * - rejeita se começar com `@` (após espaços em branco no início)
 * - rejeita se contiver qualquer letra a-z/A-Z
 * - extrai apenas dígitos; se tiver >=12 dígitos e começar com "55",
 *   remove o prefixo "55" (resultado precisa ter >=10 dígitos após remover)
 * - resultado final precisa ter >=10 dígitos, senão retorna null
 */
export function normalizarTelefone(texto: string | null | undefined): string | null {
  if (texto == null) return null;
  if (/^\s*@/.test(texto)) return null;
  if (/[a-zA-Z]/.test(texto)) return null;

  const digitos = texto.replace(/\D/g, "");

  let resultado: string;
  if (digitos.length >= 12 && digitos.slice(0, 2) === "55") {
    const semDDI = digitos.slice(2);
    resultado = semDDI.length >= 10 ? semDDI : "";
  } else if (digitos.length >= 10) {
    resultado = digitos;
  } else {
    resultado = "";
  }

  return resultado === "" ? null : resultado;
}

/**
 * Espelha `public.normalizar_instagram(text)`:
 * - casa `@` não precedido por um caractere de palavra (início da string
 *   ou precedido por não-\w), seguido por `[\w.]+`
 * - grupo capturado é convertido para minúsculas
 * - se o resultado estiver na denylist de placeholders, retorna null
 * - sem match -> null
 */
export function normalizarInstagram(texto: string | null | undefined): string | null {
  if (texto == null) return null;

  const match = texto.match(/(?:^|[^\w])@([\w.]+)/);
  if (!match) return null;

  const valor = match[1].toLowerCase();
  if (INSTAGRAM_DENYLIST.has(valor)) return null;

  return valor === "" ? null : valor;
}
