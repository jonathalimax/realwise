import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../../contexts/AccessContext';

function buildCheckoutPath(currentUser) {
  const params = new URLSearchParams();

  if (currentUser?.email) {
    params.set('email', currentUser.email);
  }

  if (currentUser?.displayName) {
    params.set('name', currentUser.displayName);
  }

  return `/checkout${params.toString() ? `?${params.toString()}` : ''}`;
}

export default function PremiumFeatureGate({
  title = 'Recurso premium',
  description = 'Esse recurso faz parte do Premium do Realwise.',
  featureName = 'Recurso premium',
}) {
  const { currentUser } = useAccess();
  const checkoutPath = useMemo(() => buildCheckoutPath(currentUser), [currentUser]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 px-4 py-8 dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-xl shadow-violet-100/60 dark:border-violet-900/40 dark:bg-gray-800 dark:shadow-black/20">
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-8 text-white sm:px-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
              <Sparkles className="h-3.5 w-3.5" />
              Premium do Realwise
            </div>
            <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-violet-50 sm:text-base">
              {description}
            </p>
          </div>

          <div className="space-y-6 px-6 py-8 sm:px-8">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                O app continua gratis para acompanhar suas financas.
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                Os 45 dias valem apenas para recursos premium, nao para o app inteiro. Entrada manual e acompanhamento basico continuam liberados.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Gratis para sempre
                </p>
                <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>Adicionar transacoes manualmente</li>
                  <li>Ver entradas e saidas por categoria</li>
                  <li>Continuar usando o controle basico do sistema</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                  Premium desbloqueia
                </p>
                <ul className="mt-3 space-y-2 text-sm text-violet-900 dark:text-violet-100">
                  <li>{featureName}</li>
                  <li>Mais profundidade para planejar e acompanhar</li>
                  <li>Melhor visao do quanto ainda sobra para gastar</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-violet-100 p-2 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Checkout seguro no Stripe
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    O checkout prioriza Apple Pay e Google Pay quando disponiveis. Se a carteira nao aparecer, o proprio Stripe oferece cartao como alternativa.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to={checkoutPath}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-700"
              >
                Desbloquear premium
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 px-6 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Continuar no plano gratis
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
