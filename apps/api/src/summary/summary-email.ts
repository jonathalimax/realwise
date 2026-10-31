import { escapeHtml } from '../notifications/email-text';
import { emailDocument, emailHeader } from '../notifications/email-layout';
import { reais } from './summary-metrics';
import type { FlowSegment, Insight, SummaryPayload, SummaryTone } from './summary.types';

/**
 * The e-mail version of the summary. Mail apps do not run scripts and many drop inline SVG, so every chart here is plain
 * HTML tables with fixed widths and heights: they render the same everywhere, with no images to host or block. The full
 * interactive version lives on the private page the button opens.
 */

const FONT = "'Plus Jakarta Sans','Segoe UI',Tahoma,Arial,sans-serif";
const SEGMENT_COLORS: Record<FlowSegment['tone'], string> = {
  slate: '#475569', violet: '#8b5cf6', sky: '#38bdf8', pink: '#f472b6', amber: '#f59e0b', saved: '#10b981', left: '#a7f3d0',
};
// `cls` re-colours the tinted block in dark mode (see DARK_CSS in email-layout.ts).
const TONES: Record<SummaryTone, { bg: string; fg: string; sub: string; bar: string; cls: string }> = {
  proud: { bg: '#ecfdf5', fg: '#047857', sub: '#065f46', bar: '#10b981', cls: 'rw-t-proud' },
  steady: { bg: '#eff6ff', fg: '#1d4ed8', sub: '#1e40af', bar: '#3b82f6', cls: 'rw-t-steady' },
  improve: { bg: '#fffbeb', fg: '#b45309', sub: '#92400e', bar: '#f59e0b', cls: 'rw-t-improve' },
  incomplete: { bg: '#f5f3ff', fg: '#6d28d9', sub: '#5b21b6', bar: '#8b5cf6', cls: 'rw-t-violet' },
  trial: { bg: '#f5f3ff', fg: '#6d28d9', sub: '#5b21b6', bar: '#8b5cf6', cls: 'rw-t-violet' },
};

const e = escapeHtml;
const short = (n: number) => (Math.abs(n) >= 10000 ? `R$ ${(Math.abs(n) / 1000).toFixed(1).replace('.', ',').replace(/,0$/, '')} mil` : reais(Math.abs(n)));

export function summarySubject(p: SummaryPayload): string {
  const month = p.period.monthName;
  switch (p.tone) {
    case 'proud': return `Seu ${month} em resumo: que mês!`;
    case 'steady': return `Seu ${month} em resumo`;
    case 'improve': return `Seu ${month} em resumo: vamos ajustar juntos`;
    case 'trial': return 'O que o Elio já descobriu nos seus dias de teste';
    default: return `Falta pouco para o resumo de ${month}`;
  }
}

/** Bold the money amounts in an already-escaped sentence. */
const emphasize = (html: string, neg: boolean) => html.replace(/R\$\s?[0-9][0-9.,]*( mil)?/g, (m) => `<strong class="${neg ? 'rw-neg' : 'rw-ink'}" style="color:${neg ? '#be123c' : '#0e1420'};">${m}</strong>`);

const spacer = (h: number) => `<tr><td height="${h}" style="font-size:0;line-height:0;">&nbsp;</td></tr>`;

function dot(color: string): string {
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:8px;"></span>`;
}

function heading(title: string, sub?: string): string {
  return `<tr><td style="padding:0 0 10px;"><div class="rw-ink" style="font-size:19px;font-weight:800;color:#0f172a;">${e(title)}</div>${sub ? `<div class="rw-muted" style="font-size:13px;color:#64748b;margin-top:2px;">${e(sub)}</div>` : ''}</td></tr>`;
}

/** Rose to amber to green scale with a dark marker at the score, built from table cells (gradients and absolute positions are unreliable in mail apps). */
function scaleBar(score: number): string {
  const pos = Math.min(98, Math.max(2, Math.round(score)));
  const zones: [number, number, string][] = [[0, 40, '#fda4af'], [40, 75, '#fcd34d'], [75, 100, '#34d399']];
  const cells: string[] = [];
  const cell = (w: number, color: string) => `<td width="${w}%" height="12" bgcolor="${color}" style="font-size:0;line-height:0;">&nbsp;</td>`;
  for (const [from, to, color] of zones) {
    if (pos > from && pos < to) {
      cells.push(cell(pos - from, color), '<td width="2%" height="12" bgcolor="#78350f" style="font-size:0;line-height:0;">&nbsp;</td>', cell(to - pos, color));
    } else cells.push(cell(to - from, color));
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-radius:999px;overflow:hidden;"><tr>${cells.join('')}</tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>
      <td align="left" class="rw-muted" style="font-size:11px;color:#64748b;">Precisa de atenção</td><td align="center" class="rw-muted" style="font-size:11px;color:#64748b;">Equilibrada</td><td align="right" class="rw-muted" style="font-size:11px;color:#64748b;">Muito boa</td>
    </tr></table>`;
}

function scoreBlock(p: SummaryPayload): string {
  if (p.score === null) return '';
  const t = TONES[p.tone];
  const delta = p.scoreDelta;
  const prev = p.period.prevMonthName;
  const deltaText = delta === null || !prev || delta === 0 ? '' : delta > 0 ? `+${delta} pontos desde ${prev}` : `${-delta} pontos abaixo de ${prev}`;
  return `<tr><td class="${t.cls}" bgcolor="${t.bg}" style="background:${t.bg};border-radius:20px;padding:22px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="bottom"><span class="rw-tfg" style="font-size:60px;line-height:1;font-weight:800;color:${t.fg};letter-spacing:-2px;">${p.score}</span><span class="rw-tfg" style="font-size:18px;font-weight:700;color:${t.fg};opacity:.6;"> / 100</span></td>
      <td valign="bottom" align="right"><div class="rw-tsub" style="font-size:15px;font-weight:800;color:${t.sub};">Saúde financeira: ${e(p.scoreLabel ?? '')}</div>${deltaText ? `<div class="rw-tfg" style="font-size:13px;color:${t.fg};">${e(deltaText)}</div>` : ''}</td>
    </tr></table>
    ${scaleBar(p.score)}
  </td></tr>`;
}

function kpis(p: SummaryPayload): string {
  const t = p.totals;
  if (p.tone === 'incomplete' || t.income + t.spent <= 0) return '';
  // A card-coloured border between cells gives the gap; margins and calc() are ignored by many mail apps.
  const cell = (label: string, value: string, tone: 'ink' | 'pos' | 'neg' | 'brand' = 'ink', bad = false) => {
    const color = { ink: '#0e1420', pos: '#047857', neg: '#be123c', brand: '#6d28d9' }[tone];
    const bg = bad ? '#fff1f2' : '#f8fafc';
    return `<td width="33%" valign="top" class="rw-gap ${bad ? 'rw-t-bad' : 'rw-soft'}" bgcolor="${bg}" style="background:${bg};border-right:8px solid #ffffff;padding:14px;"><div class="rw-muted" style="font-size:12px;color:#566072;">${e(label)}</div><div class="rw-${tone === 'ink' ? 'ink' : tone === 'brand' ? 'brand' : tone}" style="font-size:21px;font-weight:800;color:${color};">${e(value)}</div></td>`;
  };
  const third = t.invested > 0
    ? cell('Guardou', short(t.invested), 'brand')
    : t.left >= 0
      ? cell('Sobrou', short(t.left), 'pos')
      : cell('Faltou', `−${short(t.left)}`, 'neg', true);
  return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${cell('Entrou', `+${short(t.income)}`, 'pos')}${cell('Saiu', short(t.spent), t.left < 0 ? 'neg' : 'ink', t.left < 0)}${third}
  </tr></table></td></tr>`;
}

function flowBlock(p: SummaryPayload): string {
  const { segments, totalPct, overflow } = p.flow;
  if (p.totals.income <= 0 || segments.length === 0) return '';
  const base = Math.max(100, totalPct);
  // Cells in order; when spending passed the income, a dark divider marks where the income ends.
  const cells: { w: number; color: string }[] = [];
  let cum = 0;
  let marked = false;
  for (const s of segments) {
    const start = cum;
    cum += s.pct;
    if (overflow && !marked && start < 100 && cum > 100) {
      cells.push({ w: 100 - start, color: SEGMENT_COLORS[s.tone] }, { w: -1, color: '#0f172a' }, { w: cum - 100, color: SEGMENT_COLORS[s.tone] });
      marked = true;
    } else cells.push({ w: s.pct, color: SEGMENT_COLORS[s.tone] });
    if (overflow && !marked && cum === 100) { cells.push({ w: -1, color: '#0f172a' }); marked = true; }
  }
  const bar = cells
    .map((c, i) => c.w < 0
      ? '<td width="1%" height="20" bgcolor="#0f172a" style="font-size:0;line-height:0;">&nbsp;</td>'
      : `<td width="${Math.max(1, Math.round((c.w / base) * 100))}%" height="20" bgcolor="${c.color}" ${i < cells.length - 1 && cells[i + 1].w >= 0 && c.w >= 0 ? 'class="rw-gap" ' : ''}style="font-size:0;line-height:0;${i < cells.length - 1 && cells[i + 1].w >= 0 && c.w >= 0 ? 'border-right:2px solid #ffffff;' : ''}">&nbsp;</td>`)
    .join('');
  const incomeNote = overflow ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${Math.round((100 / base) * 100)}%" align="right" class="rw-ink" style="padding-top:5px;font-size:11px;font-weight:700;color:#0f172a;">sua renda (R$ 100)&nbsp;↑</td><td></td></tr></table></td></tr>` : '';
  const legend = segments
    .map((s) => `<td width="50%" class="rw-ink" style="padding:3px 0;font-size:14px;color:#334155;">${dot(SEGMENT_COLORS[s.tone])}${e(s.label)} <strong class="rw-ink" style="color:#0f172a;">${reais(s.amount)}</strong></td>`)
    .reduce<string[]>((rows, cell, i) => { if (i % 2 === 0) rows.push(cell); else rows[rows.length - 1] += cell; return rows; }, [])
    .map((r) => `<tr>${r}</tr>`)
    .join('');
  const sub = overflow ? `De cada R$ 100 que entraram, saíram R$ ${Math.round(totalPct)}. O trecho que passou da renda é o que faltou.` : 'Cada R$ 100 que entraram, e para onde foram.';
  return `${heading('Para onde foi sua renda', sub)}
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:999px;overflow:hidden;"><tr>${bar}</tr></table></td></tr>
  ${incomeNote}
  ${spacer(10)}
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${legend}</table></td></tr>`;
}

function trendBlock(p: SummaryPayload): string {
  const pts = p.trend.filter((x) => x.income + x.spent > 0);
  if (pts.length < 2) return '';
  const scale = Math.max(...p.trend.map((x) => Math.max(x.income, x.spent)), 1);
  const bar = (v: number, color: string, label = '') => `${label ? `<div class="rw-ink" style="font-size:11px;font-weight:800;color:#0f172a;text-align:center;padding-bottom:3px;">${e(label)}</div>` : ''}<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td width="20" height="${Math.max(2, Math.round((v / scale) * 90))}" bgcolor="${color}" style="border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  const last = p.trend[p.trend.length - 1];
  const cols = p.trend
    .map((m) => `<td align="center" valign="bottom" width="${Math.floor(100 / p.trend.length)}%"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="bottom" style="padding:0 2px;">${bar(m.income, '#ddd6fe')}</td><td valign="bottom" style="padding:0 2px;">${bar(m.spent, m.spent > m.income ? (m === last ? '#f43f5e' : '#fbbf24') : m === last ? TONES[p.tone].bar : '#94a3b8', m === last ? short(m.spent) : '')}</td></tr></table></td>`)
    .join('');
  const labels = p.trend.map((m) => `<td align="center" class="${m === last ? 'rw-ink' : 'rw-muted'}" style="font-size:12px;padding-top:6px;color:${m === last ? '#0e1420' : '#566072'};font-weight:${m === last ? 800 : 400};">${e(m.label)}</td>`).join('');
  return `${heading('Seus últimos meses', 'Cada mês tem duas barras: a renda (lilás) e o que você gastou.')}
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cols}</tr><tr>${labels}</tr></table></td></tr>`;
}

function insightRows(title: string, items: Insight[], mark: (i: Insight, n: number) => string): string {
  if (items.length === 0) return '';
  const rows = items
    .map((it, n) => `<tr><td valign="top" width="34" style="padding:7px 0;">${mark(it, n + 1)}</td><td valign="top" style="padding:7px 0;"><div class="rw-ink" style="font-size:15px;font-weight:700;color:#0f172a;">${e(it.title)}</div><div class="rw-muted" style="font-size:13px;color:#64748b;line-height:1.5;">${e(it.detail)}</div></td>${it.frees ? `<td valign="top" align="right" width="110" style="padding:7px 0 7px 8px;"><span class="rw-chip-ok" style="display:inline-block;font-size:12px;font-weight:800;color:#047857;background:#ecfdf5;border-radius:999px;padding:5px 10px;white-space:nowrap;">libera ${reais(it.frees)}</span></td>` : '<td></td>'}</tr>`)
    .join('');
  return `${heading(title)}<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

const BADGES = { ok: ['#d1fae5', '#047857'], bad: ['#ffe4e6', '#be123c'], warn: ['#fef3c7', '#b45309'], brand: ['#ede9fe', '#6d28d9'] } as const;
const badge = (text: string, tone: keyof typeof BADGES) => `<div class="rw-chip-${tone}" style="width:26px;height:26px;border-radius:50%;background:${BADGES[tone][0]};color:${BADGES[tone][1]};font-weight:800;font-size:14px;line-height:26px;text-align:center;">${text}</div>`;

function missingBlock(p: SummaryPayload): string {
  if (p.missing.length === 0) return '';
  const rows = p.missing
    .map((m, i) => `<tr><td valign="top" width="34" style="padding:7px 0;">${badge(String(i + 1), 'brand')}</td><td valign="top" style="padding:7px 0;"><div class="rw-ink" style="font-size:15px;font-weight:700;color:#0f172a;">${e(m.title)}</div><div class="rw-muted" style="font-size:13px;color:#64748b;line-height:1.5;">${e(m.detail)}</div></td></tr>`)
    .join('');
  return `${heading('O que falta')}<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#7c3aed" style="background:#7c3aed;border-radius:14px;"><a href="${e(href)}" style="display:block;padding:16px 24px;text-align:center;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;font-family:${FONT};">${e(label)}&nbsp;&rarr;</a></td></tr></table>`;
}

function nextStepBlock(p: SummaryPayload, pageUrl: string): string {
  const n = p.nextStep;
  const web = (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/+$/, '');
  const href = n.ctaPath.startsWith('/chat') || n.ctaPath.startsWith('/billing') ? pageUrl : `${web}${n.ctaPath}`;
  return `<tr><td class="rw-t-violet" bgcolor="#f5f3ff" style="background:#f5f3ff;border-radius:20px;padding:22px 24px;">
    <div class="rw-brand" style="font-size:11px;font-weight:800;letter-spacing:2px;color:#6d28d9;">${e(n.eyebrow)}</div>
    <div class="rw-ink" style="font-size:17px;line-height:1.45;font-weight:700;color:#0e1420;margin:8px 0 16px;">${e(n.text)}</div>
    ${ctaButton('Ver meu resumo completo', href)}
  </td></tr>`;
}

export function buildSummaryEmail(p: SummaryPayload, pageUrl: string, unsubscribeUrl: string): { subject: string; html: string } {
  const eyebrow = p.tone === 'trial' ? 'SEU TESTE EM RESUMO' : `SEU MÊS EM RESUMO · ${p.period.monthName.toUpperCase()}`;
  const winsHtml = insightRows(p.tone === 'improve' ? 'O que foi bem' : 'O que você fez bem', p.wins, () => badge('✓', 'ok'));
  const fixesHtml = insightRows(p.tone === 'trial' ? 'O que o Elio já encontrou' : 'Onde dá para ajustar', p.fixes, (it, n) => (it.urgent ? badge('!', 'bad') : badge(String(n), 'warn')));

  const sections = [
    scoreBlock(p), kpis(p), flowBlock(p), trendBlock(p), missingBlock(p), winsHtml, fixesHtml, nextStepBlock(p, pageUrl),
  ].filter(Boolean).join(spacer(22));

  const inner = `${emailHeader()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${spacer(26)}
    <tr><td><div class="rw-muted" style="font-size:12px;font-weight:700;letter-spacing:0.04em;color:#566072;">${e(eyebrow)}</div>
      <div class="rw-ink" style="font-size:38px;line-height:1.1;font-weight:800;color:#0e1420;letter-spacing:-1px;margin:8px 0;">${e(p.headline)}</div>
      <div class="rw-muted" style="font-size:18px;line-height:1.5;color:#566072;">${emphasize(e(p.subline), p.tone === 'improve')}</div></td></tr>
    ${spacer(24)}
    ${sections}
  </table>`;
  const html = emailDocument(inner, {
    title: summarySubject(p),
    footerNote: `Você recebe este resumo com os dados que registrou no Realwise. O link é só seu e expira em 30 dias. <a href="${e(unsubscribeUrl)}">Parar de receber</a>`,
  });
  return { subject: summarySubject(p), html };
}
