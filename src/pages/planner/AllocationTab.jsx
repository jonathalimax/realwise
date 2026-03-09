import { Badge } from '@/components/ui/badge';
import { formatBRL } from './usePlannerState';

function AllocationSlider({ label, emoji, value, onChange, colorClass }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {emoji} {label}
        </span>
        <span className={`text-lg font-bold tabular-nums ${colorClass}`}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500"
      />
    </div>
  );
}

export default function AllocationTab({
  state,
  update,
  liquidezFinal,
  necessidadesValue,
  poupancaValue,
  desejosValue,
}) {
  const total = state.necessidades + state.poupanca + state.desejos;
  const isValid = total === 100;

  if (liquidezFinal <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Preencha o Dashboard Financeiro para ver a alocação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sliders */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Regra 64/28/8
          </h3>
          {isValid ? (
            <Badge variant="default">✓ 100%</Badge>
          ) : (
            <Badge variant="destructive">Soma: {total}% (deve ser 100%)</Badge>
          )}
        </div>

        <div className="space-y-5">
          <AllocationSlider
            label="Necessidades"
            emoji="🏠"
            value={state.necessidades}
            onChange={v => update('necessidades', v)}
            colorClass="text-blue-600 dark:text-blue-400"
          />
          <AllocationSlider
            label="Poupança / Investimentos"
            emoji="💰"
            value={state.poupanca}
            onChange={v => update('poupanca', v)}
            colorClass="text-emerald-600 dark:text-emerald-400"
          />
          <AllocationSlider
            label="Desejos / Lazer"
            emoji="🎯"
            value={state.desejos}
            onChange={v => update('desejos', v)}
            colorClass="text-orange-500 dark:text-orange-400"
          />
        </div>
      </div>

      {/* Distribution cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
            🏠 Necessidades ({state.necessidades}%)
          </p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
            {formatBRL.format(necessidadesValue)}
          </p>
          <p className="text-xs text-blue-400 mt-1">Moradia, alimentação, contas</p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800">
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-1">
            💰 Poupança ({state.poupanca}%)
          </p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
            {formatBRL.format(poupancaValue)}
          </p>
          <p className="text-xs text-emerald-400 mt-1">Reserva + investimentos</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 border border-orange-100 dark:border-orange-800">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">
            🎯 Desejos ({state.desejos}%)
          </p>
          <p className="text-xl font-bold text-orange-700 dark:text-orange-300 tabular-nums">
            {formatBRL.format(desejosValue)}
          </p>
          <p className="text-xs text-orange-400 mt-1">Lazer, viagens, extras</p>
        </div>
      </div>

      {/* Liquidity reference */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">Liquidez Total (base)</span>
          <span className="text-base font-bold text-violet-600 dark:text-violet-400 tabular-nums">
            {formatBRL.format(liquidezFinal)}
          </span>
        </div>
        {!isValid && (
          <p className="text-xs text-red-500 mt-2">
            Ajuste os controles acima para que a soma seja exatamente 100%.
          </p>
        )}
      </div>
    </div>
  );
}
