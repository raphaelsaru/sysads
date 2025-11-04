// Configuração para timezone de Brasília
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Formata uma data para o padrão brasileiro DD/MM/AAAA
 * considerando o timezone de Brasília
 */
export function formatDateBR(date: string | Date): string {
  if (!date) return '';

  // Se for string no formato ISO (YYYY-MM-DD), processar diretamente sem timezone
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  // Para outros formatos, usar Date com timezone
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return dateObj.toLocaleDateString('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Converte uma data no formato brasileiro DD/MM/AAAA para YYYY-MM-DD (formato ISO)
 */
export function formatDateISO(brazilianDate: string): string {
  if (!brazilianDate) return '';

  // Se já está no formato ISO (YYYY-MM-DD), retorna como está
  if (brazilianDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return brazilianDate;
  }

  // Converte DD/MM/AAAA para YYYY-MM-DD
  const [day, month, year] = brazilianDate.split('/');
  if (day && month && year) {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return brazilianDate;
}

/**
 * Retorna a data atual no timezone de Brasília no formato YYYY-MM-DD
 */
export function getTodayBR(): string {
  const now = new Date();
  const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: BRAZIL_TIMEZONE }));

  return brazilDate.toISOString().split('T')[0];
}

/**
 * Retorna a data atual no timezone de Brasília no formato DD/MM/AAAA
 */
export function getTodayBRFormatted(): string {
  return formatDateBR(getTodayBR());
}