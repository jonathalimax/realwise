import { formatBRL } from './usePlannerState';

const LAYER_STYLES = {
  red:    { card: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800',       icon: 'bg-red-100 dark:bg-red-800',    title: 'text-red-700 dark:text-red-300',    text: 'text-red-600 dark:text-red-400' },
  blue:   { card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',   icon: 'bg-blue-100 dark:bg-blue-800',  title: 'text-blue-700 dark:text-blue-300',  text: 'text-blue-600 dark:text-blue-400' },
  green:  { card: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800', icon: 'bg-emerald-100 dark:bg-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', text: 'text-emerald-600 dark:text-emerald-400' },
  purple: { card: 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800', icon: 'bg-violet-100 dark:bg-violet-800', title: 'text-violet-700 dark:text-violet-300', text: 'text-violet-600 dark:text-violet-400' },
  orange: { card: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', icon: 'bg-orange-100 dark:bg-orange-800', title: 'text-orange-700 dark:text-orange-300', text: 'text-orange-600 dark:text-orange-400' },
};

const LAYERS = [
  { icon: '🛡️', label: 'Proteção',    color: 'red',    text: 'Seguro vida R$ 6M — cobre morte, invalidez e doenças graves. Protege a família em qualquer cenário.' },
  { icon: '💧', label: 'Liquidez',    color: 'blue',   text: 'Reserva de emergência — meta R$ 120.000 (6 meses). Onde: Tesouro Selic / CDB liquidez diária.' },
  { icon: '📈', label: 'Crescimento', color: 'green',  text: 'Investimentos mensais — aporte base R$ 4k, variável até R$ 6k+. Horizonte longo, consistência acima de timing.' },
  { icon: '🏠', label: 'Patrimônio',  color: 'purple', text: 'Casa própria (meta entrada em ~3 anos) + carro. Ativos reais com apreciação de longo prazo.' },
  { icon: '👨‍👩‍👧‍👦', label: 'Legado',      color: 'orange', text: 'Educação dos filhos — meta R$ 600k–1.2M. Holding familiar quando patrimônio atingir R$ 300–500k.' },
];

const REGRAS = [
  'Investir antes de gastar',
  'Não subir custo fixo',
  'Revisar anualmente',
  'Manter consistência acima de timing',
  'Diversificação global',
];

const PROXIMOS_PASSOS = [
  { label: 'Aumentar aporte',  status: 'Em progresso', note: null,                    statusColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { label: 'Reduzir custo',    status: 'Em progresso', note: null,                    statusColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { label: 'Criar holding',    status: 'Pendente',     note: 'Trigger: R$ 300–500k',  statusColor: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  { label: 'Expandir renda',   status: 'Em progresso', note: null,                    statusColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
];

function AllocationBar({ label, values }) {
  const colors = ['bg-blue-400', 'bg-emerald-400', 'bg-orange-400'];
  const names = ['Necessidades', 'Poupança', 'Desejos'];
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {values.map((v, i) => (
          <div key={i} className={`${colors[i]} transition-all`} style={{ width: `${v}%` }} title={`${names[i]}: ${v}%`} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {values.map((v, i) => (
          <span key={i} className="text-xs text-gray-400 tabular-nums">{v}%</span>
        ))}
      </div>
    </div>
  );
}

function CashFlowRow({ label, value, type, indent }) {
  const isDeduction = type === 'deduction';
  const isTotal = type === 'total';
  const isAlloc = type === 'allocation';

  return (
    <div className={`flex items-center justify-between py-2 ${isTotal ? 'border-t-2 border-violet-500 mt-1 pt-3' : 'border-t border-gray-100 dark:border-gray-700'} ${indent ? 'pl-4' : ''}`}>
      <div className="flex items-center gap-2">
        {isDeduction && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold shrink-0">−</span>
        )}
        {isAlloc && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">→</span>
        )}
        <span className={`text-sm ${isTotal ? 'font-bold text-gray-900 dark:text-white' : isAlloc ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {label}
        </span>
      </div>
      <span className={`text-sm tabular-nums font-semibold ${
        isTotal
          ? 'text-violet-600 dark:text-violet-400 text-base'
          : isDeduction
            ? 'text-red-500 dark:text-red-400'
            : isAlloc
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-900 dark:text-white'
      }`}>
        {formatBRL.format(value)}
      </span>
    </div>
  );
}

export default function SistemaTab({
  state,
  computedRendaBruta,
  simplesValue,
  despesasPJ,
  liquidezFinal,
  necessidadesValue,
  poupancaValue,
  desejosValue,
}) {
  return (
    <div className="space-y-4">

      {/* ① Visão Geral */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Visão Geral
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Sistema financeiro para proteger a família, construir patrimônio e alcançar
          <span className="font-semibold text-violet-600 dark:text-violet-400"> independência financeira (~R$ 20k/mês)</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Curto prazo', value: '2–3 anos',   color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800' },
            { label: 'Médio prazo', value: '5–10 anos',  color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800' },
            { label: 'Longo prazo', value: '15–25 anos', color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl px-3 py-2 ${color}`}>
              <p className="text-xs font-medium opacity-70">{label}</p>
              <p className="text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ② Arquitetura em Camadas */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Arquitetura em Camadas
        </h3>
        <div className="space-y-2">
          {LAYERS.map(({ icon, label, color, text }) => {
            const s = LAYER_STYLES[color];
            return (
              <div key={label} className={`rounded-xl p-3 border ${s.card} flex gap-3 items-start`}>
                <div className={`rounded-lg p-1.5 text-base shrink-0 ${s.icon}`}>{icon}</div>
                <div>
                  <p className={`text-sm font-semibold ${s.title}`}>{label}</p>
                  <p className={`text-xs mt-0.5 ${s.text}`}>{text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ③ Fluxo de Caixa — live */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Fluxo de Caixa
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          {state.useMinScenario ? 'Cenário mínimo anual' : `Mês selecionado: ${state.selectedPlannerMonth}`}
        </p>
        <div>
          <CashFlowRow label="Renda Bruta (computada)" value={computedRendaBruta} type="income" />
          <CashFlowRow label={`Simples Nacional (${state.simplesNacionalPct}%)`} value={simplesValue} type="deduction" />
          <CashFlowRow label="Despesas PJ" value={despesasPJ} type="deduction" />
          <CashFlowRow label="Liquidez Final" value={liquidezFinal} type="total" />
          <CashFlowRow label={`Necessidades (${state.necessidades}%)`} value={necessidadesValue} type="allocation" indent />
          <CashFlowRow label={`Poupança (${state.poupanca}%)`} value={poupancaValue} type="allocation" indent />
          <CashFlowRow label={`Desejos (${state.desejos}%)`} value={desejosValue} type="allocation" indent />
        </div>
      </div>

      {/* ④ Distribuição Atual vs Meta */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Distribuição: Atual vs Meta
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AllocationBar
            label="Atual"
            values={[state.necessidades, state.poupanca, state.desejos]}
          />
          <AllocationBar
            label="Meta"
            values={[56, 32, 8]}
          />
        </div>
        <div className="flex gap-4 mt-3">
          {[
            { label: 'Necessidades', color: 'bg-blue-400' },
            { label: 'Poupança',     color: 'bg-emerald-400' },
            { label: 'Desejos',      color: 'bg-orange-400' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ⑤ Regras de Ouro */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Regras de Ouro
        </h3>
        <ol className="space-y-2">
          {REGRAS.map((regra, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{regra}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ⑥ Próximos Passos */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Próximos Passos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PROXIMOS_PASSOS.map(({ label, status, note, statusColor }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
            >
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
