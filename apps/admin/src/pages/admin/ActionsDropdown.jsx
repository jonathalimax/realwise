import { useState, useRef, useEffect } from 'react';

const ACTIONS = [
  { id: 'welcome', name: 'Enviar Boas-Vindas', description: 'Envia email de boas-vindas com próximos passos.', when: 'Após pagamento', group: 'email' },
  { id: 'access', name: 'Liberar Acesso', description: 'Email com link direto para o dashboard.', when: 'Após onboarding', group: 'email' },
  { id: 'coupon', name: 'Enviar Cupom', description: 'Email com oferta especial e link de checkout com desconto.', when: 'Lead frio', group: 'email' },
  { id: 'lastchance', name: 'Última Oferta', description: 'Email com desconto final e link direto para Stripe.', when: 'Após 7+ dias sem conversão', group: 'email' },
  { id: 'onboard', name: 'Iniciar Onboarding', description: 'Cria projeto Firebase e configura acesso.', when: 'Após pagamento', group: 'ops' },
  { id: 'migration', name: 'Aceite de Migração', description: 'Email com instruções para aceitar transferência de projeto.', when: 'Após onboarding', group: 'ops' },
  { id: 'state', name: 'Alterar Estado', description: 'Muda o estado do lead manualmente.', when: 'Qualquer momento', group: 'admin' },
];

const GROUP_LABELS = { email: 'Emails', ops: 'Operações', admin: 'Admin' };

export default function ActionsDropdown({ lead, onAction, loading = new Set() }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const groups = ['email', 'ops', 'admin'];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1.5"
      >
        Ações
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {groups.map((group, gi) => {
            const groupActions = ACTIONS.filter(a => a.group === group);
            return (
              <div key={group}>
                {gi > 0 && <div className="border-t border-gray-100 dark:border-gray-700" />}
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {GROUP_LABELS[group]}
                </p>
                {groupActions.map(action => {
                  const isLoading = loading.has(action.id);
                  return (
                    <button
                      key={action.id}
                      disabled={isLoading}
                      onClick={() => { onAction(action.id, lead); setOpen(false); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                            {isLoading && (
                              <span className="inline-block w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            )}
                            {action.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                            {action.description}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5 whitespace-nowrap mt-0.5">
                          {action.when}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="h-1" />
        </div>
      )}
    </div>
  );
}
