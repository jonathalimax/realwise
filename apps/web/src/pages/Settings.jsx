import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../contexts/AccessContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useFeature } from '../contexts/ClientConfigContext';
import { apiClient } from '../lib/api/client';
import { logoutAndRedirect } from '../lib/auth/logout';
import PageHeader from '../components/PageHeader';
import Avatar from '../components/Avatar';
import { PlanBar } from '../components/billing/PlanBadge';
import ContactCard from '../components/contact/ContactCard';
import DeleteAccountCard from '../components/account/DeleteAccountCard';
import SubscriptionSettingsCard from '../components/billing/SubscriptionSettingsCard';
import { getSettingsProfile } from './settingsProfile';

const Chevron = () => <span className="text-[var(--rw-muted)]" aria-hidden="true">›</span>;

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

function Row({ to, icon, title, hint }) {
  return (
    <Link to={to} className="flex min-h-[56px] items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rw-raised)] text-[var(--rw-brand-ink)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[var(--rw-ink)]">{title}</span>
        {hint && <span className="block text-[13px] text-[var(--rw-subtle)]">{hint}</span>}
      </span>
      <Chevron />
    </Link>
  );
}

function Toggle({ on, onChange, title, hint }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[var(--rw-ink)]">{title}</span>
        {hint && <span className="block text-[13px] text-[var(--rw-subtle)]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--rw-brand)]' : 'bg-[var(--rw-border)]'}`}
      >
        <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${on ? 'left-[23px]' : 'left-[3px]'}`} />
      </button>
    </div>
  );
}

const Group = ({ label, children }) => (
  <section className="flex flex-col gap-2">
    <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-[var(--rw-muted)]">{label}</h2>
    <div className="divide-y divide-[var(--rw-border)] overflow-hidden rounded-[20px] border border-[var(--rw-border)] bg-[var(--rw-surface)]">{children}</div>
  </section>
);

/** Resizes the chosen photo to a 256px square JPEG in the browser, so the upload stays small. */
async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function SettingsPage() {
  const { currentUser } = useAccess();
  const { reloadUser } = useAuth();
  const { language, billReminders, updateBillReminders, monthlyRollover, updateMonthlyRollover, darkMode, toggleDarkMode, t } = useSettings();
  const hasInvestments = useFeature('investments');
  const pt = language === 'pt';
  const profile = useMemo(() => getSettingsProfile(currentUser), [currentUser]);
  const fileRef = useRef(null);
  const [photoState, setPhotoState] = useState('idle'); // idle | saving | error

  const choosePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoState('saving');
    try {
      const image = await resizePhoto(file);
      await apiClient.request('/auth/me/avatar', { method: 'PUT', body: { image } });
      await reloadUser();
      setPhotoState('idle');
    } catch {
      setPhotoState('error');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--rw-bg)] text-[var(--rw-ink)]">
      <PageHeader title={pt ? 'Perfil' : 'Profile'} showMonth={false} />

      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-24 pt-2 sm:px-6">
        <section className="rw-hero rw-hero-violet flex items-center gap-4 p-5" aria-label={pt ? 'Seu perfil' : 'Your profile'}>
          <Avatar size={72} ring />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold tracking-tight">{profile.name}</p>
            <p className="truncate text-sm text-violet-200">{profile.email}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoState === 'saving'}
              className="mt-2 min-h-[36px] rounded-full bg-white/10 px-3 text-xs font-bold text-violet-50 disabled:opacity-60"
            >
              {photoState === 'saving' ? (pt ? 'Enviando…' : 'Uploading…') : profile.photoUrl ? (pt ? 'Trocar foto' : 'Change photo') : (pt ? 'Adicionar foto' : 'Add photo')}
            </button>
            {photoState === 'error' && <p className="mt-1 text-xs text-rose-300" role="alert">{pt ? 'Não consegui enviar a foto. Tente outra.' : 'Could not upload the photo. Try another.'}</p>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choosePhoto} aria-label={pt ? 'Escolher foto' : 'Choose photo'} />
          </div>
        </section>

        <div className="overflow-hidden rounded-[20px] border border-[var(--rw-border)]"><PlanBar /></div>

        <Group label={pt ? 'Seu dinheiro' : 'Your money'}>
          <Row to="/bills" title={pt ? 'Contas a pagar' : 'Bills'} hint={pt ? 'Vencimentos e lembretes' : 'Due dates and reminders'}
            icon={<Icon><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4" /></Icon>} />
          <Row to="/settings/banks" title={pt ? 'Bancos e cartões' : 'Banks and cards'} hint={pt ? 'Contas, fechamento e vencimento' : 'Accounts, closing and due days'}
            icon={<Icon><path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></Icon>} />
          <Row to="/planning/categories" title={pt ? 'Categorias' : 'Categories'} hint={pt ? 'Grupos do orçamento e categorias próprias' : 'Budget groups and your own categories'}
            icon={<Icon><path d="M4 6h16M4 12h16M4 18h10" /></Icon>} />
          {hasInvestments && (
            <Row to="/investments" title={pt ? 'Investimentos' : 'Investments'} hint={pt ? 'Sua carteira' : 'Your portfolio'}
              icon={<Icon><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></Icon>} />
          )}
        </Group>

        <Group label="Elio">
          <Row to="/settings/memory" title={pt ? 'O que o Elio sabe sobre você' : 'What Elio knows about you'} hint={pt ? 'Veja, edite ou apague o que ele lembra' : 'See, edit or delete what he remembers'}
            icon={<Icon><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Icon>} />
          <Row to="/notifications" title={pt ? 'Notificações' : 'Notifications'}
            icon={<Icon><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" /></Icon>} />
        </Group>

        <Group label={pt ? 'Preferências' : 'Preferences'}>
          <Toggle on={darkMode} onChange={toggleDarkMode} title={pt ? 'Modo escuro' : 'Dark mode'} />
          <Toggle on={billReminders} onChange={updateBillReminders} title={pt ? 'Lembretes de contas' : 'Bill reminders'} hint={pt ? 'E-mail diário às 9h (Brasília)' : 'Daily e-mail at 9 AM (Brazil)'} />
          <Toggle on={monthlyRollover} onChange={updateMonthlyRollover} title={t('balance.monthlyRollover')} hint={t('balance.monthlyRolloverHelper')} />
        </Group>

        <SubscriptionSettingsCard />

        <Group label={pt ? 'Ajuda' : 'Help'}>
          <Row to="/help" title={pt ? 'Central de ajuda' : 'Help center'}
            icon={<Icon><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" /></Icon>} />
        </Group>
        <ContactCard />

        <Group label={pt ? 'Conta' : 'Account'}>
          <button type="button" onClick={() => logoutAndRedirect()} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold text-[var(--rw-ink)]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rw-raised)] text-[var(--rw-muted)]">
              <Icon><path d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" /></Icon>
            </span>
            {pt ? 'Sair da conta' : 'Sign out'}
          </button>
        </Group>
        <DeleteAccountCard />
      </div>
    </div>
  );
}
