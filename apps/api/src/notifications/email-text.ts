export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text -> brand-styled paragraphs: blank-line separated blocks, single newlines kept as line breaks, all HTML escaped. */
export function textToParagraphs(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<div style="font-size:17px;color:#475569;line-height:1.55;margin:0 0 12px;">${escapeHtml(block).replace(/\n/g, '<br />')}</div>`,
    )
    .join('');
}

/** Only absolute http(s) URLs are allowed into href attributes; anything else is dropped. */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
