// src/pages/planner/carteira/SublayerModal.jsx
import { useState, useEffect } from 'react';
import { NumericFormat } from 'react-number-format';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { SUBLAYER_TYPE_OPTIONS, formatBRL } from './constants';
import { netReturn } from './walletVersion';

export default function SublayerModal({ sublayer, layerMonthlyAmount, onSave, onDelete, onClose }) {
  const isNew = !sublayer;

  const [icon, setIcon] = useState(sublayer?.icon ?? '💰');
  const [label, setLabel] = useState(sublayer?.label ?? '');
  const [type, setType] = useState(sublayer?.type ?? 'Renda Fixa');
  const [bank, setBank] = useState(sublayer?.bank ?? '');
  const [description, setDescription] = useState(sublayer?.description ?? '');
  const [mode, setMode] = useState(sublayer?.mode ?? 'pct');
  const [pct, setPct] = useState(String(sublayer?.pct ?? 0));
  const [value, setValue] = useState(String(sublayer?.value ?? 0));
  const [goalTarget, setGoalTarget] = useState(String(sublayer?.goalTarget ?? 0));
  const [hasGoal, setHasGoal] = useState((sublayer?.goalTarget ?? 0) > 0);
  const [returnPct, setReturnPct] = useState(String(sublayer?.returnPct ?? 1.0));
  const [taxRate, setTaxRate] = useState(String(sublayer?.taxRate ?? 15));

  useEffect(() => {
    if (sublayer) {
      setIcon(sublayer.icon); setLabel(sublayer.label); setType(sublayer.type ?? 'Renda Fixa');
      setBank(sublayer.bank ?? ''); setDescription(sublayer.description ?? '');
      setMode(sublayer.mode ?? 'pct'); setPct(String(sublayer.pct ?? 0)); setValue(String(sublayer.value ?? 0));
      setGoalTarget(String(sublayer.goalTarget ?? 0)); setHasGoal((sublayer.goalTarget ?? 0) > 0);
      setReturnPct(String(sublayer.returnPct ?? 1.0)); setTaxRate(String(sublayer.taxRate ?? 15));
    }
  }, [sublayer]);

  const parsedReturnPct = parseFloat(returnPct) || 0;
  const parsedTaxRate = parseFloat(taxRate) || 0;
  const net = netReturn(parsedReturnPct, parsedTaxRate);

  const parsedPct = parseFloat(pct) || 0;
  const monthlyContrib = mode === 'pct' ? layerMonthlyAmount * (parsedPct / 100) : (parseFloat(value) || 0);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({
      icon: icon.trim() || '💰',
      label: label.trim(),
      type,
      bank,
      description: description.trim(),
      mode,
      pct: Math.max(0, Math.min(100, parseFloat(pct) || 0)),
      value: parseFloat(value) || 0,
      goalTarget: hasGoal ? (parseFloat(goalTarget) || 0) : 0,
      returnPct: parseFloat(returnPct) || 1.0,
      taxRate: parseFloat(taxRate) || 15,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{isNew ? 'Novo Produto' : 'Editar Produto'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg">✕</button>
        </div>

        {/* Icon + Label */}
        <div className="flex gap-3">
          <div className="w-16">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Ícone</label>
            <input type="text" value={icon} onChange={e => setIcon(e.target.value)} maxLength={2}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Nome</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Fundo Emergência"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        {/* Type + Bank */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
              {SUBLAYER_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Banco / Corretora</label>
            <input type="text" value={bank} onChange={e => setBank(e.target.value)}
              placeholder="Ex: Nubank, XP, BTG..."
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        {/* Return + Tax */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Retorno bruto % a.m.</label>
            <NumericFormat
              value={returnPct === '0' || returnPct === '' ? '' : returnPct}
              onValueChange={vals => setReturnPct(String(vals.floatValue ?? 0))}
              decimalSeparator=","
              decimalScale={3}
              suffix=" %/mês"
              allowNegative={false}
              placeholder="1,000 %/mês"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Líq: {net.toFixed(3)}% a.m.</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Alíquota IRPF %</label>
            <NumericFormat
              value={taxRate === '0' || taxRate === '' ? '' : taxRate}
              onValueChange={vals => setTaxRate(String(vals.floatValue ?? 0))}
              decimalSeparator=","
              decimalScale={0}
              suffix=" %"
              allowNegative={false}
              placeholder="15 %"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Contribution mode */}
        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-2">Aporte mensal</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setMode('pct')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${mode === 'pct' ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              % da camada
            </button>
            <button onClick={() => setMode('value')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${mode === 'value' ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              Valor fixo R$
            </button>
          </div>
          {mode === 'pct' ? (
            <div className="flex items-center gap-2">
              <NumericFormat
                value={pct === '0' || pct === '' ? '' : pct}
                onValueChange={vals => setPct(String(vals.floatValue ?? 0))}
                decimalSeparator=","
                decimalScale={0}
                suffix=" %"
                allowNegative={false}
                placeholder="0 %"
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <span className="text-xs text-gray-400">% → {formatBRL.format(monthlyContrib)}/mês</span>
            </div>
          ) : (
            <CurrencyInput
              value={parseFloat(value) || 0}
              onChange={v => setValue(String(v))}
              placeholder="R$ 500,00"
            />
          )}
        </div>

        {/* Goal target */}
        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-2">Meta</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setHasGoal(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${hasGoal ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              Com meta
            </button>
            <button onClick={() => setHasGoal(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${!hasGoal ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              Reserva contínua
            </button>
          </div>
          {hasGoal && (
            <CurrencyInput
              value={parseFloat(goalTarget) || 0}
              onChange={v => setGoalTarget(String(v))}
              placeholder="R$ 120.000,00"
            />
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Descrição <span className="font-normal">(opcional)</span></label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Ex: CDB liq. diária / Tesouro Selic 2027"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!label.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-bold transition-colors">
            {isNew ? 'Criar produto' : 'Salvar'}
          </button>
          {!isNew && onDelete && (
            <button onClick={onDelete}
              className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-rose-100 transition-colors">
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
