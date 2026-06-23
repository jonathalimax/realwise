export const ONBOARDING_KEY = 'import_swipe_onboarding_seen';

export default function ImportOnboardingOverlay({ onDismiss }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col px-4">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Content pinned near the bottom, where the new nav buttons live */}
      <div className="relative mt-auto mb-4 w-full max-w-sm self-center flex flex-col gap-3">
        {/* Spotlighted bottom nav buttons */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl border-2 border-violet-400 shadow-[0_0_0_6px_rgba(167,139,250,0.25)] bg-gray-800 flex items-center justify-center text-white text-3xl font-black">
            ‹
          </div>
          <div className="flex-1 h-14 rounded-2xl border-2 border-violet-400 shadow-[0_0_0_6px_rgba(167,139,250,0.25)] bg-gray-800 flex items-center justify-center text-white text-sm font-black uppercase tracking-widest">
            Próximo ›
          </div>
        </div>

        {/* Tooltip */}
        <div className="text-center">
          <span className="inline-block bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-xl">
            Use os botões para navegar entre as transações
          </span>
        </div>

        {/* Green callout */}
        <div className="flex items-center gap-3 p-4 bg-emerald-950/90 border border-emerald-700 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-black text-base">
            ✓
          </div>
          <div>
            <p className="text-sm font-bold text-white">Revise cada transação</p>
            <p className="text-xs text-emerald-300 mt-0.5">
              Suas edições ficam guardadas até concluir
            </p>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
        >
          Entendi, vamos lá
        </button>
      </div>
    </div>
  );
}
