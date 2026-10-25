/**
 * Reduces a bank description to a stable merchant pattern ("IFOOD*AB12CD 05/04" -> "IFOOD"), the
 * key of a categorization rule. Mirrors apps/web/src/services/categorizationService.js extractPattern
 * so rules created by either side match each other.
 */
export function extractPattern(description: string): string {
  if (!description) return '';
  let p = description
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  p = p.replace(/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/g, '');
  p = p.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');
  p = p.replace(/\s*PARCELA\s*\d+\s*[/DE]\s*\d+/gi, '');
  p = p.replace(/\s*\(\d+[/]\d+\)/g, '');
  p = p.replace(/\s*\d+\s*[/]\s*\d+\s*(?:PARCELAS?)?/gi, '');
  p = p.replace(/\b\d{6,}\b/g, '');
  p = p.replace(/[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}/gi, '');
  p = p.replace(/\s*-\s*[A-Z]{2,}\s+[A-Z]{2}$/g, '');
  p = p.replace(/\*[A-Z0-9]{4,}/g, '');
  p = p.replace(/\s+\d{2}\/\d{2}$/g, '');
  p = p.replace(/^(TRANSF|TED|DOC|PAGAMENTO|RECEBIDO)\s+/g, '');
  p = p.replace(/\s*\*\d{4,}/g, '');
  p = p.replace(/\s+/g, ' ').trim();
  if (p.length > 50) {
    const first = p.split(/\s{2,}|-/)[0].trim();
    p = first.length >= 3 ? first : p.substring(0, 50);
  }
  return p;
}

/**
 * Key for long-term categorization memory: the merchant name only. Cuts everything after a "*" (card
 * processors append trip/order codes there) and drops bare numbers, so "UBER *TRIP 999" and
 * "UBER *TRIP 123456789" both remember as "UBER".
 */
export function merchantKey(description: string): string {
  const base = extractPattern(description);
  const beforeStar = base.split('*')[0].trim();
  const head = beforeStar.length >= 3 ? beforeStar : base.replace(/\*/g, ' ');
  const words = head.split(' ').filter((w) => w && !/^\d+$/.test(w));
  return words.join(' ').trim();
}
