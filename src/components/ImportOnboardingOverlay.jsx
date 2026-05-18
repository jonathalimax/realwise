export const ONBOARDING_KEY = 'import_swipe_onboarding_seen';

export default function ImportOnboardingOverlay({ onDismiss }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col px-4">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Spotlight nav row — aligned with where the nav header sits inside the 85svh sheet */}
      <div
        className="relative flex items-center justify-center gap-3"
        style={{ marginTop: 'calc(15svh + 2.75rem)' }}
      >
        <div className="w-9 h-9 rounded-xl border-2 border-violet-400 shadow-[0_0_0_6px_rgba(167,139,250,0.25)] bg-gray-800 flex items-center justify-center text-white text-xl font-black">
          ‹
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-28 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="w-[11%] h-full bg-white rounded-full" />
          </div>
          <span className="text-xs font-bold text-gray-400">1 de 27</span>
        </div>
        <div className="w-9 h-9 rounded-xl border-2 border-violet-400 shadow-[0_0_0_6px_rgba(167,139,250,0.25)] bg-gray-800 flex items-center justify-center text-white text-xl font-black">
          ›
        </div>
      </div>

      {/* Rest of content — pinned to bottom of sheet */}
      <div className="relative mt-auto mb-4 w-full max-w-sm self-center flex flex-col gap-3">
        {/* Tooltip */}
        <div className="text-center">
          <span className="inline-block bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-xl">
            ‹ › ou arraste para navegar
          </span>
        </div>

        {/* Green callout */}
        <div className="flex items-center gap-3 p-4 bg-emerald-950/90 border border-emerald-700 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-black text-base">
            ✓
          </div>
          <div>
            <p className="text-sm font-bold text-white">Navegue à vontade</p>
            <p className="text-xs text-emerald-300 mt-0.5">
              Suas edições ficam guardadas até o final
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
