/**
 * The one e-mail design every message uses (see `.ai/features/notifications-email.md`).
 *
 * Mail apps ignore flexbox, CSS variables and inline SVG, so everything here is table markup with light-mode colours
 * inline. Dark mode is a `prefers-color-scheme` block that re-colours the `rw-*` classes with `!important`; a client
 * that skips it (old Outlook, Gmail's forced inversion) still gets a readable light e-mail. The colours are the
 * Realwise design-system tokens: page `bg`, white `surface` card, tinted panel, one violet `brand`.
 */

export const LOGO_URL = 'https://realwise.com.br/logo.png';
const FONT = "'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Emoji for the round tile at the top, by name. Emoji (not SVG or images) so Gmail and Outlook render them everywhere. */
export const ICONS: Record<string, string> = {
  welcome: '👋',
  activation: '🚀',
  insights: '📊',
  hourglass: '⏳',
  locked: '🔒',
  bills: '🔔',
  payment: '💳',
  gift: '🎁',
  heart: '💜',
  import: '📥',
  idea: '💡',
  check: '✅',
  cart: '🛒',
  coupon: '🎟️',
  alarm: '⏰',
  sparkle: '✨',
};

const DARK_CSS = `
  :root{color-scheme:light dark;supported-color-schemes:light dark}
  .rw-foot a{color:#6a7385 !important;text-decoration:underline}
  @media (max-width:480px){
    .rw-wrap{padding:12px 8px !important}
    .rw-card{padding:22px 18px 20px !important}
    .rw-panel{padding:20px 18px !important}
  }
  @media (prefers-color-scheme:dark){
    .rw-page{background:#0b0f17 !important}
    .rw-card{background:#131a25 !important;border-color:#243042 !important}
    .rw-panel,.rw-soft{background:#1b2331 !important}
    .rw-tile{background:#1b2331 !important}
    .rw-panel .rw-tile,.rw-tile-in{background:#2a3447 !important}
    .rw-ink{color:#f3f5f9 !important}
    .rw-muted{color:#9aa4b6 !important}
    .rw-subtle,.rw-foot,.rw-foot a{color:#7e889b !important}
    .rw-brand{color:#b9a2fb !important}
    .rw-link{color:#b9a2fb !important}
    .rw-pos{color:#34d399 !important}
    .rw-neg{color:#fb7185 !important}
    .rw-warn{color:#fbbf24 !important}
    .rw-line{border-color:#33415a !important}
    .rw-gap{border-color:#131a25 !important}
    .rw-bubble-in{background:#131a25 !important;border-color:#2f3b50 !important}
    .rw-support{color:#34d399 !important}
    .rw-chip-warn{background:#3a2f12 !important;color:#fbbf24 !important}
    .rw-chip-ok{background:#0f3a2e !important;color:#34d399 !important}
    .rw-chip-bad{background:#3d1620 !important;color:#fb7185 !important}
    .rw-chip-brand{background:#2a2147 !important;color:#b9a2fb !important}
    .rw-t-proud{background:#0f2f27 !important}
    .rw-t-steady{background:#14263f !important}
    .rw-t-improve{background:#33290f !important}
    .rw-t-violet{background:#241d3d !important}
    .rw-t-bad{background:#3d1620 !important}
    .rw-t-proud .rw-tfg{color:#34d399 !important}.rw-t-proud .rw-tsub{color:#6ee7b7 !important}
    .rw-t-steady .rw-tfg{color:#93c5fd !important}.rw-t-steady .rw-tsub{color:#bfdbfe !important}
    .rw-t-improve .rw-tfg{color:#fbbf24 !important}.rw-t-improve .rw-tsub{color:#fcd34d !important}
    .rw-t-violet .rw-tfg{color:#b9a2fb !important}.rw-t-violet .rw-tsub{color:#d4c5fd !important}
  }
`;

const CHIPS = {
  warn: { cls: 'rw-chip-warn', bg: '#fef3c7', fg: '#b45309' },
  ok: { cls: 'rw-chip-ok', bg: '#d1fae5', fg: '#047857' },
  bad: { cls: 'rw-chip-bad', bg: '#ffe4e6', fg: '#be123c' },
  brand: { cls: 'rw-chip-brand', bg: '#ede9fe', fg: '#6d28d9' },
} as const;

export type ChipTone = keyof typeof CHIPS;

const line = (margin = '16px 0 0') =>
  `<div class="rw-line" style="border-top:1px dotted #cfd5e1;margin:${margin};font-size:0;line-height:0;height:0;">&nbsp;</div>`;

/** Body paragraph. No colour of its own: it takes it from the block it sits in (panel text, muted lead, or ink body). */
export const para = (text: string) => `<div style="font-size:17px;line-height:26px;margin:0 0 12px;">${text}</div>`;

/** Small uppercase label above a section. */
export const sectionLabel = (text: string) =>
  `<div class="rw-muted" style="margin:0 0 8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#566072;">${text}</div>`;

/** Highlights: a round emoji tile, a bold line and an optional short description, one per row. */
export const rows = (items: ([string, string] | [string, string, string])[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">${items
    .map(
      ([icon, title, desc]) =>
        `<tr>
          <td width="64" valign="top" style="padding:0 0 18px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="rw-tile" width="48" height="48" align="center" bgcolor="#f4f0ff" style="width:48px;height:48px;border-radius:999px;background:#f4f0ff;font-size:22px;line-height:48px;text-align:center;">${icon}</td></tr></table></td>
          <td valign="top" style="padding:0 0 18px;"><div class="rw-ink" style="font-size:18px;line-height:26px;font-weight:700;color:#0e1420;">${title}</div>${
            desc ? `<div class="rw-muted" style="margin-top:2px;font-size:16px;line-height:24px;color:#566072;">${desc}</div>` : ''
          }</td>
        </tr>`,
    )
    .join('')}</table>`;

/** Label on the left, bold value on the right, a dotted line between rows. `tone` colours the value. */
export const detailRows = (items: { label: string; sub?: string; value: string; tone?: 'pos' | 'neg' | 'warn' }[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items
    .map((it) => {
      const toneCls = it.tone ? ` rw-${it.tone}` : ' rw-ink';
      const toneColor = it.tone === 'pos' ? '#047857' : it.tone === 'neg' ? '#be123c' : it.tone === 'warn' ? '#b45309' : '#0e1420';
      return `<tr>
        <td class="rw-line" valign="middle" style="padding:12px 0;border-top:1px dotted #cfd5e1;"><div class="rw-ink" style="font-size:17px;line-height:24px;font-weight:700;color:#0e1420;">${it.label}</div>${
          it.sub ? `<div class="rw-muted" style="font-size:14px;line-height:20px;color:#566072;">${it.sub}</div>` : ''
        }</td>
        <td class="rw-line${toneCls}" valign="middle" align="right" style="padding:12px 0 12px 12px;border-top:1px dotted #cfd5e1;font-size:18px;line-height:24px;font-weight:800;color:${toneColor};white-space:nowrap;">${it.value}</td>
      </tr>`;
    })
    .join('')}</table>`;

/** A short chat preview: `me` bubbles are violet and on the right, `elio` bubbles are white and on the left. */
export const chat = (messages: { from: 'me' | 'elio'; html: string }[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr><td class="rw-panel" bgcolor="#f4f0ff" style="background:#f4f0ff;border-radius:20px;padding:24px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${messages
      .map((m) =>
        m.from === 'me'
          ? `<tr><td align="right" style="padding:0 0 10px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#7c3aed" style="background:#7c3aed;border-radius:20px 20px 6px 20px;padding:12px 18px;font-size:16px;line-height:23px;font-weight:500;color:#ffffff;">${m.html}</td></tr></table></td></tr>`
          : `<tr><td align="left" style="padding:0 0 10px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="rw-bubble-in rw-ink" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e2e6ed;border-radius:20px 20px 20px 6px;padding:13px 18px;font-size:16px;line-height:23px;color:#0e1420;">${m.html}</td></tr></table></td></tr>`,
      )
      .join('')}</table>
  </td></tr></table>`;

const logo = (size = 32) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${LOGO_URL}" alt="" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:10px;object-fit:contain;" /></td>
    <td class="rw-ink" style="padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-0.4px;color:#0e1420;">Realwise</td>
  </tr></table>`;

function button(label: string, href: string, kind: 'block' | 'pill'): string {
  const text = `${label}&nbsp;&rarr;`;
  const a = (extra: string) =>
    `<a href="${href}" style="display:block;box-sizing:border-box;padding:17px 28px;text-align:center;text-decoration:none;font-size:17px;line-height:22px;font-weight:700;color:#ffffff;font-family:${FONT};${extra}">${text}</a>`;
  if (kind === 'block') {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td bgcolor="#7c3aed" style="background:#7c3aed;border-radius:14px;">${a('')}</td></tr></table>`;
  }
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:26px auto 0;"><tr><td bgcolor="#7c3aed" style="background:#7c3aed;border-radius:999px;">${a('')}</td></tr></table>`;
}

export interface EmailParts {
  title: string;
  /** Shown under the title, before the button. HTML (use `para`) or plain text. */
  lead?: string;
  /** Everything below the button: `rows`, `chat`, `detailRows`, plain `para`s. */
  body?: string;
  cta?: string;
  ctaUrl?: string;
  /** Small italic line at the very bottom (why they got this, the unsubscribe link). */
  footerNote?: string;
  /** Adds the WhatsApp support button. Only where the person may be stuck. */
  support?: boolean;
  /** Key of `ICONS`, or a raw emoji. */
  icon?: string;
  /** Status chip at the top right (panel layout). */
  chip?: { text: string; tone: ChipTone };
  /** `panel`: title, text and button inside a tinted panel (data e-mails). `centered`: icon, big headline, pill button (warm e-mails). */
  variant?: 'panel' | 'centered';
}

/** The e-mail document around already-built content: page background, card, header, signature and footer. */
export function emailDocument(inner: string, { title = 'Realwise', footerNote = 'Realwise' }: { title?: string; footerNote?: string } = {}): string {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${title.replace(/<[^>]*>/g, '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${DARK_CSS}</style>
</head>
<body class="rw-page" style="margin:0;padding:0;background:#f5f6f9;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rw-page" bgcolor="#f5f6f9" style="background:#f5f6f9;"><tr><td align="center" class="rw-wrap" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr>
    <td class="rw-card" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e2e6ed;border-radius:24px;padding:28px 28px 24px;font-family:${FONT};">
      ${inner}
      ${line('32px 0 0')}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>
        <td class="rw-line" style="padding-right:20px;border-right:1px dotted #cfd5e1;height:56px;">${logo(32)}</td>
        <td class="rw-ink" style="padding-left:20px;font-size:15px;line-height:23px;color:#0e1420;">Um abraço,<br />Time Realwise</td>
      </tr></table>
      ${line('20px 0 0')}
      <div class="rw-foot rw-subtle" style="margin-top:16px;text-align:center;font-size:13px;line-height:19px;font-style:italic;color:#6a7385;">${footerNote}</div>
    </td>
  </tr></table>
</td></tr></table>
</body></html>`;
}

/** The header row: logo on the left, optional status chip on the right. */
export function emailHeader(chip?: { text: string; tone: ChipTone }): string {
  const c = chip ? CHIPS[chip.tone] : null;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>${logo(32)}</td>
    ${c ? `<td align="right"><span class="${c.cls}" style="display:inline-block;padding:6px 14px;border-radius:999px;background:${c.bg};color:${c.fg};font-size:13px;line-height:18px;font-weight:700;">${chip!.text}</span></td>` : ''}
  </tr></table>
  ${line('16px 0 0')}`;
}

export function buildEmail(p: EmailParts): string {
  const whatsapp = (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '') || '5541992310339';
  const href = p.ctaUrl || 'https://realwise.com.br';
  const icon = p.icon ? (ICONS[p.icon] ?? p.icon) : '';
  const variant = p.variant ?? 'panel';

  const top =
    variant === 'centered'
      ? `<div style="text-align:center;padding-top:32px;">
          ${icon ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td class="rw-tile" width="72" height="72" align="center" bgcolor="#f4f0ff" style="width:72px;height:72px;border-radius:24px;background:#f4f0ff;font-size:34px;line-height:72px;text-align:center;">${icon}</td></tr></table>` : ''}
          <div class="rw-ink" style="margin-top:20px;font-size:36px;line-height:44px;font-weight:800;letter-spacing:-0.5px;color:#0e1420;">${p.title}</div>
          ${p.lead ? `<div class="rw-muted" style="margin-top:12px;font-size:18px;line-height:27px;color:#566072;">${p.lead}</div>` : ''}
          ${p.cta ? button(p.cta, href, 'pill') : ''}
        </div>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td class="rw-panel" bgcolor="#f4f0ff" style="background:#f4f0ff;border-radius:20px;padding:24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${icon ? `<td valign="middle" style="padding-right:12px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="rw-tile-in" width="36" height="36" align="center" bgcolor="#ffffff" style="width:36px;height:36px;border-radius:999px;background:#ffffff;font-size:18px;line-height:36px;text-align:center;">${icon}</td></tr></table></td>` : ''}
            <td valign="middle" class="rw-brand" style="font-size:26px;line-height:32px;font-weight:800;letter-spacing:-0.5px;color:#6d28d9;">${p.title}</td>
          </tr></table>
          ${p.lead ? `<div class="rw-ink" style="margin-top:14px;font-size:17px;line-height:26px;color:#0e1420;">${p.lead}</div>` : ''}
          ${p.cta ? button(p.cta, href, 'block') : ''}
        </td></tr></table>`;

  const support = p.support
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr><td align="center"><a class="rw-support" href="https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Realwise.')}" style="display:block;box-sizing:border-box;padding:15px 24px;text-align:center;text-decoration:none;border:2px solid #25d366;border-radius:14px;font-size:16px;line-height:20px;font-weight:700;color:#15803d;">Falar com o suporte</a></td></tr></table>`
    : '';

  const inner = `${emailHeader(p.chip)}
    ${top}
    ${p.body ? `<div class="rw-ink" style="margin-top:${variant === 'centered' ? 32 : 24}px;color:#0e1420;">${p.body}</div>` : ''}
    ${support}`;
  return emailDocument(inner, { title: p.title, footerNote: p.footerNote });
}
