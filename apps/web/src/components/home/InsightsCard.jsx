import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { summaryResource } from '../../lib/api/resources/summary';
import HomeCard from './HomeCard';
import { isFresh, readCache, writeCache } from '../../lib/queryCache';

const INSIGHTS_KEY = 'insights';
const INSIGHTS_FRESH_MS = 5 * 60 * 1000;
// The first insights are always fully readable; only the one peeking out behind "Ver mais" is faded.
const PREVIEW_COUNT = 3;

const TONES = {
  urgent: 'bg-[#fb718522] text-[var(--rw-neg)]',
  fix: 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]',
  win: 'bg-[#34d39922] text-[var(--rw-pos)]',
};

function InsightItem({ it, index, navigate, formatCurrency, pt, inert = false }) {
  return (
    <button
      type="button"
      tabIndex={inert ? -1 : undefined}
      onClick={() => it.href && navigate(it.href)}
      className="flex w-full gap-3 rounded-2xl bg-[var(--rw-raised)] p-3.5 text-left"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${TONES[it.kind] ?? TONES.fix}`}>
        {it.kind === 'win' ? '✓' : it.kind === 'urgent' ? '!' : index + 1}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[15px] font-semibold text-[var(--rw-ink)]">{it.title}</span>
        <span className="text-sm leading-5 text-[var(--rw-muted)]">{it.detail}</span>
        {it.frees > 0 && (
          <span className="self-start rounded-full bg-[#34d39922] px-2.5 py-1 text-xs font-bold text-[var(--rw-pos)]">
            {pt ? 'libera' : 'frees'} {formatCurrency(it.frees).replace(/,00(?=\D*$)/, '')}{pt ? '/mês' : '/mo'}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * "Insights do Elio": the month's findings, the first three in full, a faded peek of the next one and a "Ver mais" button for the rest.
 * Numbers stay in the text of each insight; the card itself shows no figures.
 */
export default function InsightsCard() {
  const { language, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const pt = language === 'pt';
  const [items, setItems] = useState(() => readCache(INSIGHTS_KEY)?.data ?? null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    if (isFresh(readCache(INSIGHTS_KEY), INSIGHTS_FRESH_MS)) return undefined;
    summaryResource.insights().then((d) => { const list = d.items ?? []; writeCache(INSIGHTS_KEY, list); if (alive) setItems(list); }).catch((e) => { console.error('insights failed', e); if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);

  if (!items) return null;
  if (items.length === 0) {
    return (
      <HomeCard title={pt ? 'Insights do Elio' : "Elio's insights"}>
        <p className="text-[15px] leading-snug text-[var(--rw-muted)]">
          {pt ? 'Assim que você registrar mais movimentos, o Elio mostra aqui o que dá para ajustar e o que está indo bem.' : 'Once you record more entries, Elio shows here what to adjust and what is going well.'}
        </p>
        <button type="button" onClick={() => navigate('/chat')} className="mt-3 h-11 w-full rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold text-[var(--rw-ink)]">
          {pt ? 'Enviar um extrato ao Elio' : 'Send a statement to Elio'}
        </button>
      </HomeCard>
    );
  }

  const hiddenCount = Math.max(0, items.length - PREVIEW_COUNT);
  const visible = open ? items : items.slice(0, PREVIEW_COUNT);
  const peek = !open && hiddenCount > 0 ? items[PREVIEW_COUNT] : null;

  return (
    <HomeCard title={pt ? 'Insights do Elio' : "Elio's insights"}>
      <ul className="flex flex-col gap-2.5">
        {visible.map((it, i) => (
          <li key={`${it.title}-${i}`}>
            <InsightItem it={it} index={i} navigate={navigate} formatCurrency={formatCurrency} pt={pt} />
          </li>
        ))}
      </ul>
      {peek && (
        <div className="pointer-events-none relative mt-2.5 max-h-[56px] overflow-hidden" aria-hidden>
          <InsightItem it={peek} index={PREVIEW_COUNT} navigate={navigate} formatCurrency={formatCurrency} pt={pt} inert />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--rw-surface)]" />
        </div>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 h-11 w-full rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold text-[var(--rw-ink)]"
        >
          {open ? (pt ? 'Mostrar menos' : 'Show less') : (pt ? `Ver mais (${hiddenCount})` : `See more (${hiddenCount})`)}
        </button>
      )}
    </HomeCard>
  );
}
