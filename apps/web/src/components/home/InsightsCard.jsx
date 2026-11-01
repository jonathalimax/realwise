import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { summaryResource } from '../../lib/api/resources/summary';
import HomeCard from './HomeCard';

const TONES = {
  urgent: 'bg-[#fb718522] text-[var(--rw-neg)]',
  fix: 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]',
  win: 'bg-[#34d39922] text-[var(--rw-pos)]',
};

/**
 * "Insights do Elio": the month's findings, closed to roughly half height with a fade, and a button to read them all.
 * Numbers stay in the text of each insight; the card itself shows no figures.
 */
export default function InsightsCard() {
  const { language, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const pt = language === 'pt';
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    summaryResource.insights().then((d) => alive && setItems(d.items ?? [])).catch((e) => { console.error('insights failed', e); if (alive) setItems([]); });
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

  return (
    <HomeCard title={pt ? 'Insights do Elio' : "Elio's insights"}>
      <div className="relative" style={open ? undefined : { maxHeight: 150, overflow: 'hidden' }}>
        <ul className="flex flex-col gap-2.5">
          {items.map((it, i) => (
            <li key={`${it.title}-${i}`}>
              <button
                type="button"
                onClick={() => it.href && navigate(it.href)}
                className="flex w-full gap-3 rounded-2xl bg-[var(--rw-raised)] p-3.5 text-left"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${TONES[it.kind] ?? TONES.fix}`}>
                  {it.kind === 'win' ? '✓' : it.kind === 'urgent' ? '!' : i + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[15px] font-semibold text-[var(--rw-ink)]">{it.title}</span>
                  <span className="text-[13px] leading-[18px] text-[var(--rw-muted)]">{it.detail}</span>
                  {it.frees > 0 && (
                    <span className="self-start rounded-full bg-[#34d39922] px-2.5 py-1 text-xs font-bold text-[var(--rw-pos)]">
                      {pt ? 'libera' : 'frees'} {formatCurrency(it.frees).replace(/,00(?=\D*$)/, '')}{pt ? '/mês' : '/mo'}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] bg-gradient-to-b from-transparent to-[var(--rw-surface)]" />}
      </div>
      {items.length > 1 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 h-11 w-full rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold text-[var(--rw-ink)]"
        >
          {open ? (pt ? 'Mostrar menos' : 'Show less') : (pt ? 'Ver todos os insights' : 'See all insights')}
        </button>
      )}
    </HomeCard>
  );
}
