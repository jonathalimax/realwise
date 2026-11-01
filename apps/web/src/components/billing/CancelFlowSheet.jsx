import { useState } from 'react';
import { Gift } from 'lucide-react';
import BottomSheet from '../chat/BottomSheet';
import { billingResource } from '../../lib/api/resources/billing';

const REASONS = [
  ['too_expensive', 'Está caro para mim'],
  ['unused', 'Não estou usando o suficiente'],
  ['missing_features', 'Faltam recursos que eu preciso'],
  ['too_complex', 'Achei difícil de usar'],
  ['switched_service', 'Vou usar outro serviço'],
  ['low_quality', 'A qualidade não foi a esperada'],
  ['customer_service', 'Não gostei do atendimento'],
  ['other', 'Outro motivo'],
];

const COMMENT_PROMPT = {
  missing_features: 'O que está faltando?',
  too_complex: 'O que foi difícil?',
  switched_service: 'Para qual serviço você vai? (opcional)',
};

const PRIMARY = 'w-full rounded-xl bg-[var(--rw-brand)] py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50';
const DANGER = 'w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50';
const GHOST = 'w-full rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50';

/**
 * Cancelling asks why, may offer one thing that fits the answer, and then cancels. The way out is never blocked:
 * if anything in the first steps fails, the person still reaches the final "Cancelar assinatura" button.
 */
export default function CancelFlowSheet({ periodEnd, onClose, onDone }) {
  const [step, setStep] = useState('reason'); // reason | offer | confirm
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [feedbackId, setFeedbackId] = useState(null);
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const next = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await billingResource.cancelFlowStart(reason, comment.trim() || undefined);
      setFeedbackId(res.feedbackId);
      setOffer(res.offer);
      setStep(res.offer ? 'offer' : 'confirm');
    } catch {
      // Could not record the answer: do not trap the person, go straight to the cancel button.
      setStep('confirm');
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await billingResource.cancelFlowAccept(feedbackId);
      await onDone('accepted');
    } catch {
      setError('Não consegui aplicar a oferta agora. Você pode tentar de novo ou seguir com o cancelamento.');
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    setBusy(true);
    setError('');
    try {
      await billingResource.cancelFlowConfirm(feedbackId);
      await onDone('cancelled');
    } catch {
      setError('Não consegui cancelar agora. Tente de novo em instantes ou fale com a gente.');
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={step === 'offer' ? 'Antes de ir…' : 'Cancelar assinatura?'} onClose={() => !busy && onClose()}>
      {step === 'reason' && (
        <>
          <p className="text-sm text-[var(--rw-ink)]">Que pena! Pode nos contar o motivo? Leva 10 segundos e ajuda a gente a melhorar.</p>
          <div className="space-y-2" role="radiogroup" aria-label="Motivo do cancelamento">
            {REASONS.map(([key, label]) => (
              <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${reason === key ? 'border-violet-500 bg-[var(--rw-brand-soft)]' : 'border-[var(--rw-border)]'}`}>
                <input type="radio" name="cancel-reason" value={key} checked={reason === key} onChange={() => setReason(key)} className="h-4 w-4 accent-violet-600" />
                <span className="text-[var(--rw-ink)]">{label}</span>
              </label>
            ))}
          </div>
          {reason && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={COMMENT_PROMPT[reason] ?? 'Quer contar mais? (opcional)'}
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--rw-brand)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          )}
          <button disabled={!reason || busy} onClick={next} className={PRIMARY}>{busy ? 'Aguarde…' : 'Continuar'}</button>
          <button onClick={onClose} disabled={busy} className={GHOST}>Manter minha assinatura</button>
        </>
      )}

      {step === 'offer' && offer && (
        <>
          <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-white">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-200"><Gift className="h-4 w-4" /> Uma oferta para você</p>
            <p className="mt-2 text-xl font-black">{offer.title}</p>
            <p className="mt-2 text-sm text-white/85">{offer.description}</p>
          </div>
          {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{error}</p>}
          <button disabled={busy} onClick={accept} className={PRIMARY}>{busy ? 'Aplicando…' : 'Aceitar e continuar assinando'}</button>
          <button disabled={busy} onClick={() => setStep('confirm')} className={GHOST}>Não, quero cancelar mesmo assim</button>
        </>
      )}

      {step === 'confirm' && (
        <>
          <p className="text-sm text-[var(--rw-ink)]">
            {periodEnd ? `Você continua com acesso completo até ${periodEnd}.` : 'Você continua com acesso completo até o fim do período já pago.'} Depois disso o acesso é pausado e seus dados ficam guardados. Você pode reativar quando quiser.
          </p>
          {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{error}</p>}
          <button disabled={busy} onClick={confirmCancel} className={DANGER}>{busy ? 'Cancelando…' : 'Cancelar assinatura'}</button>
          <button disabled={busy} onClick={onClose} className={GHOST}>Manter minha assinatura</button>
        </>
      )}
    </BottomSheet>
  );
}
