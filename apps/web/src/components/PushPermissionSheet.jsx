import { useEffect, useState } from 'react';
import { enablePush, getPushState, isStandalone, syncPushSubscription } from '../lib/push';

const KEY = 'rw.pushAsk';
const MAX_ASKS = 3;
const SNOOZE_MS = 3 * 86400000;

const readAsks = () => {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
};
const writeAsks = (value) => {
  try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private mode: asks again next launch */ }
};

/**
 * The installed app asks for notification permission the first time it opens (and again, gently, up to three times
 * if the person says "agora não"). iOS only shows the system dialog from a tap, so this sheet is that tap.
 * Once permission is granted it quietly re-registers the device on every launch.
 */
export default function PushPermissionSheet() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let timer;
    (async () => {
      if (!isStandalone()) return;
      await syncPushSubscription();
      if ((await getPushState()) !== 'off' || Notification.permission !== 'default') return;
      const { count = 0, at = 0 } = readAsks();
      if (count >= MAX_ASKS || Date.now() - at < SNOOZE_MS) return;
      timer = setTimeout(() => setOpen(true), 1200);
    })();
    return () => clearTimeout(timer);
  }, []);

  if (!open) return null;

  const later = () => {
    writeAsks({ count: (readAsks().count ?? 0) + 1, at: Date.now() });
    setOpen(false);
  };
  const accept = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const result = await enablePush();
      if (result === 'on' || result === 'denied') {
        writeAsks({ count: MAX_ASKS, at: Date.now() }); // answered: never ask again
        setOpen(false);
      } else later();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Ativar notificações">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[88dvh] w-full max-w-lg flex-col gap-4 rounded-t-[28px] border border-b-0 border-[var(--rw-border)] bg-[var(--rw-surface)] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 text-[var(--rw-ink)]">
        <span className="mx-auto h-1 w-10 rounded-full bg-[var(--rw-border)]" />
        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" /></svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[22px] font-extrabold leading-7 tracking-tight">Quer que o Elio te avise?</h2>
          <p className="text-[15px] text-[var(--rw-muted)]">Um aviso quando uma conta estiver para vencer e quando ele terminar de ler seu extrato. Poucos por semana, nada de spam.</p>
        </div>
        {failed && <p className="text-sm text-[var(--rw-neg)]" role="alert">Não consegui ativar agora. Tente de novo.</p>}
        <button type="button" disabled={busy} onClick={accept} className="h-[54px] rounded-[16px] bg-[var(--rw-brand)] text-base font-bold text-white disabled:opacity-60">
          {busy ? 'Ativando…' : 'Ativar notificações'}
        </button>
        <button type="button" disabled={busy} onClick={later} className="min-h-[44px] text-sm font-semibold text-[var(--rw-muted)]">Agora não</button>
      </div>
    </div>
  );
}
