// Bradesco PF PDF text format (extracted via pdfjs).
// Header includes "Histórico" and amount columns. Each row may or may not start with a date;
// rows without a date inherit the last seen date. Last two numeric tokens are amount + balance.
// Sign is inferred from the balance delta vs. previous balance.

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseDate(dmy) {
  const [d, m, y] = dmy.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
}

export function parseBradescoPdf(text) {
  // Remove page headers (Bradesco Celular ... Folha: N/M)
  const cleaned = text.replace(/Bradesco Celular.*?Folha:\s*\d+\/\d+/gs, ' ');

  // Remove footer ("Aviso!" onward) — if present
  const noFooter = cleaned.replace(/Aviso!.*$/s, '');

  // Normalize whitespace to single spaces
  let body = noFooter.replace(/\s+/g, ' ').trim();

  // Split on full dates (dd/mm/yyyy) — inject newlines before them
  // Safe because descriptions only contain short dates (dd/mm) without 4-digit years
  body = body.replace(/(\d{2}\/\d{2}\/\d{4})/g, '\n$1');

  const segments = body.split('\n').map(s => s.trim()).filter(Boolean);

  const out = [];
  let prevBalance = null;
  let currentDate = null;

  for (const segment of segments) {
    // Check if segment starts with a full date
    const dateMatch = segment.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/s);
    let remainder;
    if (dateMatch) {
      currentDate = dateMatch[1];
      remainder = dateMatch[2].trim();
    } else {
      remainder = segment;
    }

    if (!currentDate) continue;
    if (!remainder) continue;

    // Each transaction ends with: 6-7digit docto + two BR amounts
    // Use global regex to find all transactions within the segment
    const TX_PATTERN = /(.+?)\s+(\d{5,7})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})(?=\s|$)/g;

    let match;
    const txMatches = [];

    while ((match = TX_PATTERN.exec(remainder)) !== null) {
      txMatches.push({
        desc: match[1].trim(),
        docto: match[2],
        amount: match[3],
        balance: match[4],
      });
    }

    if (txMatches.length === 0) {
      // Handle COD. LANC. 0 with balance only (no docto)
      const codMatch = remainder.match(/COD\.\s*LANC\.\s*0\s+([\d.]+,\d{2})/);
      if (codMatch) {
        prevBalance = parseBrAmount(codMatch[1]);
      }
      continue;
    }

    for (const tx of txMatches) {
      const descText = tx.desc;

      // Skip COD. LANC. rows
      if (/^COD\.\s*LANC\./i.test(descText)) {
        prevBalance = parseBrAmount(tx.balance);
        continue;
      }

      // Skip "Total" summary rows
      if (/^Total$/i.test(descText)) continue;

      const amount = parseBrAmount(tx.amount);
      const balance = parseBrAmount(tx.balance);

      if (!Number.isFinite(amount)) continue;

      let type = 'expense';
      if (Number.isFinite(balance) && prevBalance != null) {
        type = balance >= prevBalance ? 'income' : 'expense';
      }
      if (Number.isFinite(balance)) prevBalance = balance;

      out.push({
        date: parseDate(currentDate),
        amount: Math.abs(amount),
        type,
        description: descText.trim(),
        originalId: tx.docto,
      });
    }
  }

  return out;
}

export function detectBradescoPdf(text) {
  return /Bradesco/i.test(text) && /Histórico|Historico/i.test(text);
}
