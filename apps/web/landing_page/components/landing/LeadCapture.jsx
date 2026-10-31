import React, { useState } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { submitLead } from '../../landingTracking';
import { formatBrPhone, isValidBrPhone } from '../../phoneMask';

/** "Receive news and promotions" form: name and email required, WhatsApp optional (Brazilian mask), explicit consent (LGPD). */
export default function LeadCapture() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'sending') return;
    if (!isValidBrPhone(phone)) {
      setError('Confira o WhatsApp: use o DDD e o número, por exemplo (11) 91234-5678.');
      return;
    }
    setError('');
    setState('sending');
    try {
      await submitLead({ name: name.trim(), email, phone, consent, website });
      setState('done');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  };

  return (
    <section id="novidades" data-section="lead-capture" className="px-6 pb-20">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-8 text-center shadow-sm">
        {state === 'done' ? (
          <div className="py-4">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-3 text-2xl font-bold">Anotado! 💜</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">Você vai receber as novidades e promoções do Realwise. Quando quiser, é só começar o teste grátis.</p>
          </div>
        ) : (
          <>
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
              <Mail className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Quer ficar por dentro?</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">Receba novidades do Elio, dicas de dinheiro e promoções antes de todo mundo.</p>
            <form onSubmit={submit} className="mt-6 space-y-3 text-left">
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu melhor e-mail"
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatBrPhone(e.target.value))}
                placeholder="WhatsApp: (11) 91234-5678 (opcional)"
                autoComplete="tel-national"
                inputMode="tel"
                maxLength={16}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" name="website" />
              <label className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
                <span>Aceito receber e-mails (e mensagens, se eu informar o WhatsApp) com novidades e promoções do Realwise. Posso cancelar quando quiser.</span>
              </label>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={!consent || !email || name.trim().length < 2 || state === 'sending'}
                className="h-12 w-full rounded-xl bg-violet-600 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
              >
                {state === 'sending' ? 'Enviando…' : 'Quero receber novidades'}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
