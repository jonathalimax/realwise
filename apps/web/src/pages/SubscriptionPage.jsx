import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, CreditCard, Repeat, XCircle, RotateCcw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import BottomSheet from '../components/chat/BottomSheet';
import { useAccess } from '../contexts/AccessContext';
import { useAuth } from '../contexts/AuthContext';
import { billingResource } from '../lib/api/resources/billing';
import { formatDate, formatMoney, getBillingCopy } from '../components/billing/billingCopy';

const PLAN_NAME = { monthly: 'Mensal', annual: 'Anual' };

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, children, onClick, disabled, tone = 'default' }) {
  const tones = {
    default: 'text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700',
    danger: 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20',
    primary: 'text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-900/20',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {children}
    </button>
  );
}

/** Manage the plan: switch monthly/annual, cancel (keeps access until the period ends), resume, update payment. */
export default function SubscriptionPage() {
  const { access } = useAccess();
  const { reloadUser } = useAuth();
  const labels = getBillingCopy('pt');
  const [status, setStatus] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'cancel' | 'monthly' | 'annual'
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, text }

  const loadStatus = useCallback(() => billingResource.status().then(setStatus).catch(() => {}), []);
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (!access) return null;

  const periodEnd = formatDate(access.currentPeriodEnd, labels.locale);
  const isSubscribed = access.state === 'subscribed';
  const canChoosePlan = access.state === 'trial' || access.state === 'blocked';
  const planName = PLAN_NAME[access.plan] ?? null;
  const otherPlan = access.plan === 'annual' ? 'monthly' : 'annual';
  const price = status?.amountCents ? formatMoney(status.amountCents, status.currency, labels.locale) : null;

  const headline =
    access.state === 'owner' ? 'Acesso total' : access.state === 'lifetime' ? 'Acesso vitalício' : isSubscribed ? 'Acesso completo' : 'Teste grátis';

  const run = async (fn, successText) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await Promise.all([reloadUser(), loadStatus()]);
      setConfirm(null);
      setNotice({ tone: 'ok', text: successText });
    } catch (e) {
      setConfirm(null);
      setNotice({
        tone: 'error',
        text: e?.status === 409 ? 'Essa alteração não é possível para a sua assinatura agora.' : 'Não consegui concluir agora. Tente de novo em instantes ou fale com a gente.',
      });
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      const { url } = await billingResource.createPortal();
      if (!url) throw new Error('missing url');
      window.location.assign(url);
    } catch {
      setBusy(false);
      setNotice({ tone: 'error', text: labels.paywall.portalError });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title="Assinatura" />
      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <section className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-violet-600/20">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-200">
            <Crown className="h-4 w-4" /> {headline}
          </p>
          <p className="mt-2 text-2xl font-black">{planName ? `Plano ${planName}` : headline}</p>
          {isSubscribed && periodEnd && (
            <p className="mt-1 text-sm text-white/80">
              {access.cancelAtPeriodEnd ? `Acesso até ${periodEnd}` : `Renova em ${periodEnd}`}
              {price ? ` · ${price}/${access.plan === 'annual' ? 'ano' : 'mês'}` : ''}
            </p>
          )}
          {!isSubscribed && access.state === 'trial' && <p className="mt-1 text-sm text-white/80">Você está no período de teste.</p>}
        </section>

        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-xl p-3 text-sm ${notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}
          >
            {notice.text}
          </p>
        )}

        {isSubscribed && access.cancelAtPeriodEnd && periodEnd && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{labels.settings.cancelNotice(periodEnd)}</p>
        )}
        {access.subscriptionStatus === 'past_due' && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{labels.settings.pastDue}</p>
        )}

        {isSubscribed && (
          <section className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
            {access.cancelAtPeriodEnd ? (
              <ActionButton icon={RotateCcw} tone="primary" disabled={busy} onClick={() => run(() => billingResource.resume(), 'Assinatura reativada. Que bom ter você por aqui!')}>
                Reativar assinatura
              </ActionButton>
            ) : (
              <>
                <ActionButton icon={Repeat} disabled={busy} onClick={() => setConfirm(otherPlan)}>
                  {otherPlan === 'annual' ? 'Mudar para o plano anual' : 'Mudar para o plano mensal'}
                </ActionButton>
                <ActionButton icon={XCircle} tone="danger" disabled={busy} onClick={() => setConfirm('cancel')}>
                  Cancelar assinatura
                </ActionButton>
              </>
            )}
            {access.canManageBilling && (
              <ActionButton icon={CreditCard} disabled={busy} onClick={openPortal}>
                Atualizar forma de pagamento e faturas
              </ActionButton>
            )}
          </section>
        )}

        {canChoosePlan && (
          <Link
            to="/billing"
            className="flex min-h-12 items-center justify-center rounded-xl bg-violet-600 text-base font-semibold text-white hover:bg-violet-700"
          >
            Escolher um plano
          </Link>
        )}

        {(access.state === 'owner' || access.state === 'lifetime') && (
          <section className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
            <Row label="Situação" value={headline} />
            <p className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">Você tem acesso completo ao Realwise, sem cobrança.</p>
          </section>
        )}
      </main>

      {confirm === 'cancel' && (
        <BottomSheet title="Cancelar assinatura?" onClose={() => !busy && setConfirm(null)}>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {periodEnd ? `Você continua com acesso completo até ${periodEnd}.` : 'Você continua com acesso completo até o fim do período já pago.'} Depois disso o acesso é pausado e seus dados ficam guardados. Você pode reativar quando quiser.
          </p>
          <button
            disabled={busy}
            onClick={() => run(() => billingResource.cancel(), 'Assinatura cancelada. Você mantém o acesso até o fim do período.')}
            className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? 'Cancelando…' : 'Cancelar assinatura'}
          </button>
          <button onClick={() => setConfirm(null)} className="w-full rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
            Manter minha assinatura
          </button>
        </BottomSheet>
      )}

      {(confirm === 'monthly' || confirm === 'annual') && (
        <BottomSheet title={confirm === 'annual' ? 'Mudar para o plano anual?' : 'Mudar para o plano mensal?'} onClose={() => !busy && setConfirm(null)}>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {confirm === 'annual'
              ? 'No plano anual você economiza em relação a pagar mês a mês. O valor proporcional ao que você já pagou é ajustado automaticamente.'
              : 'Você passa a pagar mês a mês. O valor proporcional ao que você já pagou é ajustado automaticamente.'}
          </p>
          <button
            disabled={busy}
            onClick={() => run(() => billingResource.changePlan(confirm), `Pronto! Você agora está no plano ${PLAN_NAME[confirm].toLowerCase()}.`)}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? 'Alterando…' : 'Confirmar mudança'}
          </button>
          <button onClick={() => setConfirm(null)} className="w-full rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
            Voltar
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
