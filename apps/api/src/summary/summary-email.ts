import { escapeHtml } from '../notifications/email-text';
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
const TONES: Record<SummaryTone, { bg: string; fg: string; sub: string; bar: string }> = {
  proud: { bg: '#ecfdf5', fg: '#047857', sub: '#065f46', bar: '#10b981' },
  steady: { bg: '#eff6ff', fg: '#1d4ed8', sub: '#1e40af', bar: '#3b82f6' },
  improve: { bg: '#fffbeb', fg: '#b45309', sub: '#92400e', bar: '#f59e0b' },
  incomplete: { bg: '#f5f3ff', fg: '#6d28d9', sub: '#5b21b6', bar: '#8b5cf6' },
  trial: { bg: '#f5f3ff', fg: '#6d28d9', sub: '#5b21b6', bar: '#8b5cf6' },
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

const spacer = (h: number) => `<tr><td height="${h}" style="font-size:0;line-height:0;">&nbsp;</td></tr>`;

function dot(color: string): string {
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:8px;"></span>`;
}

function heading(title: string, sub?: string): string {
  return `<tr><td style="padding:0 0 10px;"><div style="font-size:19px;font-weight:800;color:#0f172a;">${e(title)}</div>${sub ? `<div style="font-size:13px;color:#64748b;margin-top:2px;">${e(sub)}</div>` : ''}</td></tr>`;
}

function scoreBlock(p: SummaryPayload): string {
  if (p.score === null) return '';
  const t = TONES[p.tone];
  const delta = p.scoreDelta;
  const prev = p.period.prevMonthName;
  const deltaText = delta === null || !prev || delta === 0 ? '' : delta > 0 ? `+${delta} pontos desde ${prev}` : `${-delta} pontos abaixo de ${prev}`;
  const pos = Math.min(100, Math.max(0, p.score));
  return `<tr><td style="background:${t.bg};border-radius:16px;padding:20px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="bottom"><span style="font-size:60px;line-height:1;font-weight:800;color:${t.fg};letter-spacing:-2px;">${p.score}</span><span style="font-size:18px;font-weight:700;color:${t.fg};opacity:.6;"> / 100</span></td>
      <td valign="bottom" align="right"><div style="font-size:15px;font-weight:800;color:${t.sub};">Saúde financeira: ${e(p.scoreLabel ?? '')}</div>${deltaText ? `<div style="font-size:13px;color:${t.fg};">${e(deltaText)}</div>` : ''}</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>
      <td width="${pos}%" height="12" bgcolor="${t.bar}" style="border-radius:999px 0 0 999px;font-size:0;line-height:0;">&nbsp;</td>
      <td width="${100 - pos}%" height="12" bgcolor="#ffffff" style="border-radius:0 999px 999px 0;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>`;
}

function kpis(p: SummaryPayload): string {
  const t = p.totals;
  if (p.tone === 'incomplete' || t.income + t.spent <= 0) return '';
  // A white border between cells gives the gap; margins and calc() are ignored by many mail apps.
  const cell = (label: string, value: string, color = '#0f172a', bg = '#f8fafc') =>
    `<td width="33%" valign="top" bgcolor="${bg}" style="background:${bg};border-right:8px solid #ffffff;padding:14px;"><div style="font-size:12px;color:#64748b;">${e(label)}</div><div style="font-size:21px;font-weight:800;color:${color};">${e(value)}</div></td>`;
  const third = t.invested > 0
    ? cell('Guardou', short(t.invested), '#7c3aed')
    : t.left >= 0
      ? cell('Sobrou', short(t.left), '#047857')
      : cell('Faltou', `−${short(t.left)}`, '#be123c', '#fff1f2');
  return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${cell('Entrou', `+${short(t.income)}`, '#047857')}${cell('Saiu', short(t.spent), t.left < 0 ? '#be123c' : '#0f172a', t.left < 0 ? '#fff1f2' : '#f8fafc')}${third}
  </tr></table></td></tr>`;
}

function flowBlock(p: SummaryPayload): string {
  const { segments, totalPct, overflow } = p.flow;
  if (p.totals.income <= 0 || segments.length === 0) return '';
  const base = Math.max(100, totalPct);
  const bar = segments
    .map((s, i) => `<td width="${Math.max(1, Math.round((s.pct / base) * 100))}%" height="20" bgcolor="${SEGMENT_COLORS[s.tone]}" style="font-size:0;line-height:0;${i < segments.length - 1 ? 'border-right:2px solid #ffffff;' : ''}">&nbsp;</td>`)
    .join('');
  const legend = segments
    .map((s) => `<td width="50%" style="padding:3px 0;font-size:14px;color:#334155;">${dot(SEGMENT_COLORS[s.tone])}${e(s.label)} <strong style="color:#0f172a;">${reais(s.amount)}</strong></td>`)
    .reduce<string[]>((rows, cell, i) => { if (i % 2 === 0) rows.push(cell); else rows[rows.length - 1] += cell; return rows; }, [])
    .map((r) => `<tr>${r}</tr>`)
    .join('');
  const sub = overflow ? `De cada R$ 100 que entraram, saíram R$ ${Math.round(totalPct)}. O trecho que passou da renda é o que faltou.` : 'Cada R$ 100 que entraram, e para onde foram.';
  return `${heading('Para onde foi sua renda', sub)}
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:999px;overflow:hidden;"><tr>${bar}</tr></table></td></tr>
  ${spacer(10)}
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${legend}</table></td></tr>`;
}

function trendBlock(p: SummaryPayload): string {
  const pts = p.trend.filter((x) => x.income + x.spent > 0);
  if (pts.length < 2) return '';
  const scale = Math.max(...p.trend.map((x) => Math.max(x.income, x.spent)), 1);
  const bar = (v: number, color: string) => `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td width="14" height="${Math.max(2, Math.round((v / scale) * 90))}" bgcolor="${color}" style="font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  const last = p.trend[p.trend.length - 1];
  const cols = p.trend
    .map((m) => `<td align="center" valign="bottom" width="${Math.floor(100 / p.trend.length)}%"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="bottom" style="padding:0 2px;">${bar(m.income, '#ddd6fe')}</td><td valign="bottom" style="padding:0 2px;">${bar(m.spent, m === last ? TONES[p.tone].bar : '#94a3b8')}</td></tr></table></td>`)
    .join('');
  const labels = p.trend.map((m) => `<td align="center" style="font-size:12px;padding-top:6px;color:${m === last ? '#0f172a' : '#64748b'};font-weight:${m === last ? 800 : 400};">${e(m.label)}</td>`).join('');
  return `${heading('Seus últimos meses', 'Cada mês tem duas barras: a renda (lilás) e o que você gastou.')}
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cols}</tr><tr>${labels}</tr></table></td></tr>`;
}

function insightRows(title: string, items: Insight[], mark: (i: Insight, n: number) => string): string {
  if (items.length === 0) return '';
  const rows = items
    .map((it, n) => `<tr><td valign="top" width="34" style="padding:7px 0;">${mark(it, n + 1)}</td><td valign="top" style="padding:7px 0;"><div style="font-size:15px;font-weight:700;color:#0f172a;">${e(it.title)}</div><div style="font-size:13px;color:#64748b;line-height:1.5;">${e(it.detail)}</div>${it.frees ? `<div style="margin-top:4px;"><span style="display:inline-block;font-size:12px;font-weight:800;color:#047857;background:#ecfdf5;border-radius:999px;padding:3px 9px;">libera ${reais(it.frees)}</span></div>` : ''}</td></tr>`)
    .join('');
  return `${heading(title)}<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

const badge = (text: string, bg: string, fg: string) => `<div style="width:26px;height:26px;border-radius:50%;background:${bg};color:${fg};font-weight:800;font-size:14px;line-height:26px;text-align:center;">${text}</div>`;

function missingBlock(p: SummaryPayload): string {
  if (p.missing.length === 0) return '';
  const rows = p.missing
    .map((m, i) => `<tr><td valign="top" width="34" style="padding:7px 0;">${badge(String(i + 1), '#ede9fe', '#6d28d9')}</td><td valign="top" style="padding:7px 0;"><div style="font-size:15px;font-weight:700;color:#0f172a;">${e(m.title)}</div><div style="font-size:13px;color:#64748b;line-height:1.5;">${e(m.detail)}</div></td></tr>`)
    .join('');
  return `${heading('O que falta')}<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#7c3aed" style="border-radius:12px;"><a href="${e(href)}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;font-family:${FONT};">${e(label)}</a></td></tr></table>`;
}

function nextStepBlock(p: SummaryPayload, pageUrl: string): string {
  const n = p.nextStep;
  const web = (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/+$/, '');
  const href = n.ctaPath.startsWith('/chat') || n.ctaPath.startsWith('/billing') ? pageUrl : `${web}${n.ctaPath}`;
  return `<tr><td style="background:#f5f3ff;border-radius:16px;padding:20px 22px;">
    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#6d28d9;">${e(n.eyebrow)}</div>
    <div style="font-size:17px;line-height:1.45;font-weight:700;color:#0f172a;margin:8px 0 14px;">${e(n.text)}</div>
    ${ctaButton('Ver meu resumo completo', href)}
  </td></tr>`;
}

export function buildSummaryEmail(p: SummaryPayload, pageUrl: string, unsubscribeUrl: string): { subject: string; html: string } {
  const eyebrow = p.tone === 'trial' ? 'SEU TESTE EM RESUMO' : `SEU MÊS EM RESUMO · ${p.period.monthName.toUpperCase()}`;
  const winsHtml = insightRows(p.tone === 'improve' ? 'O que foi bem' : 'O que você fez bem', p.wins, () => badge('✓', '#d1fae5', '#047857'));
  const fixesHtml = insightRows(p.tone === 'trial' ? 'O que o Elio já encontrou' : 'Onde dá para ajustar', p.fixes, (it, n) => (it.urgent ? badge('!', '#ffe4e6', '#be123c') : badge(String(n), '#fef3c7', '#b45309')));

  const sections = [
    scoreBlock(p), kpis(p), flowBlock(p), trendBlock(p), missingBlock(p), winsHtml, fixesHtml, nextStepBlock(p, pageUrl),
  ].filter(Boolean).join(spacer(22));

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(summarySubject(p))}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;"><tr><td style="padding:30px 30px 26px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="34" height="34" bgcolor="#10b981" align="center" style="border-radius:10px;font-weight:800;font-size:17px;color:#ffffff;">R</td><td style="padding-left:10px;font-size:11px;font-weight:800;letter-spacing:3px;color:#047857;">REALWISE</td></tr></table></td></tr>
    ${spacer(22)}
    <tr><td><div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;">${e(eyebrow)}</div>
      <div style="font-size:34px;line-height:1.1;font-weight:800;color:#0f172a;letter-spacing:-1px;margin:8px 0;">${e(p.headline)}</div>
      <div style="font-size:16px;line-height:1.55;color:#334155;">${e(p.subline)}</div></td></tr>
    ${spacer(22)}
    ${sections}
    ${spacer(24)}
    <tr><td style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;line-height:1.6;color:#94a3b8;">Você recebe este resumo com os dados que registrou no Realwise. O link é só seu e expira em 30 dias. <a href="${e(unsubscribeUrl)}" style="color:#7c3aed;">Parar de receber</a></td></tr>
  </table>
</td></tr></table>
</td></tr></table></body></html>`;
  return { subject: summarySubject(p), html };
}
