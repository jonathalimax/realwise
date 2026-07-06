import { ArrowRight, CreditCard, QrCode, Smartphone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPaymentMethodOptions } from './premiumCheckout';

const METHOD_ICONS = {
  apple_pay: Wallet,
  google_pay: Smartphone,
  pix: QrCode,
  card: CreditCard,
};

export default function PaymentMethodChooser({
  feature,
  form,
  error,
  loadingMethod,
  onChange,
  onSelectMethod,
}) {
  const inputClass = 'w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition';
  const methods = getPaymentMethodOptions();

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] md:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
          Premium features only
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          {feature ? `Unlock ${feature}` : 'Unlock premium tools'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Manual transactions and imports stay free. Premium unlocks planning, bills, investments, and guidance about how much you still have available to spend.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Nome</label>
            <input
              className={inputClass}
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</label>
            <input
              className={inputClass}
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="voce@exemplo.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">WhatsApp</label>
            <input
              className={inputClass}
              name="whatsapp"
              value={form.whatsapp}
              onChange={onChange}
              placeholder="(41) 99999-9999"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Cupom <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              className={`${inputClass} uppercase`}
              name="coupon"
              value={form.coupon}
              onChange={onChange}
              placeholder="VIP45"
            />
          </div>
        </div>

        <div className="space-y-3">
          {methods.map((option) => {
            const Icon = METHOD_ICONS[option.id] || Wallet;
            const active = loadingMethod === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectMethod(option)}
                disabled={Boolean(loadingMethod)}
                className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <div className="mt-0.5 rounded-xl bg-white p-2 text-emerald-600 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                      {option.provider === 'stripe' ? 'Stripe' : 'Mercado Pago'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{option.description}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                    {active ? 'Continuando...' : 'Continuar'}
                    <ArrowRight className="h-4 w-4" />
                  </p>
                </div>
              </button>
            );
          })}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            Your 45-day Premium Access only applies to advanced features. The free core stays available even if you decide not to upgrade later.
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-slate-300"
          onClick={() => window.location.assign(feature ? '/dashboard' : '/login')}
        >
          Continue with free core
        </Button>
      </div>
    </div>
  );
}
