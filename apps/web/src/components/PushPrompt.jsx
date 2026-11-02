import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPushState } from '../lib/push';

const DISMISS_KEY = 'rw.pushPrompt.dismissedAt';
const SNOOZE_MS = 14 * 86400000;

const snoozed = () => {
  try {
    return Date.now() - Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
};

/** One quiet card on Home, for people whose device could get push but has it off. "Agora não" hides it for two weeks. */
export default function PushPrompt({ pt = true }) {
  const [state, setState] = useState(null);
  const [hidden, setHidden] = useState(snoozed);
  useEffect(() => { getPushState().then(setState); }, []);

  if (hidden || (state !== 'off' && state !== 'install')) return null;
  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode: it just comes back next time */ }
    setHidden(true);
  };

  return (
    <section className="rw-card flex flex-col gap-3" aria-label={pt ? 'Ativar notificações' : 'Turn on notifications'}>
      <div>
        <h3 className="text-[17px] font-bold">{pt ? 'Não perca nenhuma conta' : 'Never miss a bill'}</h3>
        <p className="mt-1 text-[15px] text-[var(--rw-muted)]">
          {state === 'install'
            ? (pt ? 'Instale o Realwise na Tela de Início e receba um aviso quando uma conta vencer.' : 'Add Realwise to your Home Screen to get a heads-up when a bill is due.')
            : (pt ? 'Ative as notificações e o Elio avisa quando uma conta vence ou seu extrato fica pronto.' : 'Turn on notifications and Elio tells you when a bill is due.')}
        </p>
      </div>
      <div className="flex gap-2">
        <Link to="/notifications" className="flex h-11 flex-1 items-center justify-center rounded-[14px] bg-[var(--rw-brand)] text-sm font-bold text-white">
          {state === 'install' ? (pt ? 'Ver como instalar' : 'See how') : (pt ? 'Ativar' : 'Turn on')}
        </Link>
        <button type="button" onClick={dismiss} className="h-11 rounded-[14px] bg-[var(--rw-raised)] px-4 text-sm font-semibold text-[var(--rw-muted)]">{pt ? 'Agora não' : 'Not now'}</button>
      </div>
    </section>
  );
}
