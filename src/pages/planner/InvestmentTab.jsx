import { useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL } from './usePlannerState';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function ClassRow({ cls, index, onChange, onRemove }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className="px-3 py-2">
        <input
          type="text"
          value={cls.name}
          onChange={e => onChange(index, 'name', e.target.value)}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </td>
      <td className="px-3 py-2 w-24">
        <NumericFormat
          value={cls.pct}
          onValueChange={vals => onChange(index, 'pct', vals.floatValue ?? 0)}
          decimalSeparator=","
          decimalScale={0}
          suffix=" %"
          allowNegative={false}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </td>
      <td className="px-3 py-2 w-32">
        <NumericFormat
          value={cls.returnPct}
          onValueChange={vals => onChange(index, 'returnPct', vals.floatValue ?? 0)}
          decimalSeparator=","
          decimalScale={2}
          suffix=" %/mês"
          allowNegative={false}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={cls.vehicle}
          onChange={e => onChange(index, 'vehicle', e.target.value)}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function InvestmentTab({ state, update, poupancaValue, livresPhase2, investmentProjections, liquidezFinal }) {
  const { geminiApiKey } = useSettings();
  const [geminiAnalysis, setGeminiAnalysis] = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState('');

  const totalPct = state.investmentClasses.reduce((a, c) => a + c.pct, 0);
  const pctValid = totalPct === 100;

  const handleClassChange = (index, field, value) => {
    const updated = state.investmentClasses.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    );
    update('investmentClasses', updated);
  };

  const handleAddClass = () => {
    update('investmentClasses', [
      ...state.investmentClasses,
      { name: 'Nova classe', pct: 0, returnPct: 0.8, vehicle: '' },
    ]);
  };

  const handleRemoveClass = (index) => {
    update('investmentClasses', state.investmentClasses.filter((_, i) => i !== index));
  };

  const handleGeminiAnalysis = async () => {
    if (!geminiApiKey) return;
    setGeminiLoading(true);
    setGeminiError('');
    setGeminiAnalysis('');

    const prompt = `Você é um consultor financeiro brasileiro especialista em investimentos. Analise a seguinte carteira de investimentos e forneça uma avaliação objetiva e recomendações práticas em português.

CONTEXTO FINANCEIRO:
- Liquidez mensal disponível: ${formatBRL.format(liquidezFinal)}
- Valor mensal investido (poupança): ${formatBRL.format(poupancaValue)}

CARTEIRA ATUAL:
${state.investmentClasses.map(c => `- ${c.name}: ${c.pct}% da carteira, retorno estimado ${c.returnPct}%/mês, veículo: ${c.vehicle}`).join('\n')}

PROJEÇÕES DE PATRIMÔNIO (FV com aportes mensais):
${investmentProjections.map(p => `- ${p.years} anos: ${formatBRL.format(p.FV)}`).join('\n')}

Por favor, forneça:
1. Avaliação de cada classe de ativo (diversificação, risco, adequação)
2. Pontos fortes da carteira
3. Riscos identificados
4. 3 recomendações práticas de melhoria
5. Retorno médio ponderado atual e sugestão de meta

Seja direto e prático. Máximo 500 palavras.`;

    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Resposta vazia do Gemini');
      setGeminiAnalysis(text);
    } catch (e) {
      setGeminiError(e.message || 'Erro desconhecido');
    } finally {
      setGeminiLoading(false);
    }
  };

  if (liquidezFinal <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Preencha o Dashboard Financeiro para ver as projeções de investimento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Classes table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Classes de Ativos</h3>
            {pctValid ? (
              <Badge variant="default">✓ 100%</Badge>
            ) : (
              <Badge variant="destructive">Soma: {totalPct}%</Badge>
            )}
          </div>
          <button
            onClick={handleAddClass}
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium"
          >
            + Adicionar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Classe</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">% Carteira</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Retorno</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Veículo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {state.investmentClasses.map((cls, i) => (
                <ClassRow
                  key={i}
                  cls={cls}
                  index={i}
                  onChange={handleClassChange}
                  onRemove={handleRemoveClass}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projections */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Projeções de Patrimônio (Invest. Livres: {formatBRL.format(livresPhase2 ?? poupancaValue)}/mês)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {investmentProjections.map(p => (
            <div key={p.years} className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3 border border-violet-100 dark:border-violet-800 text-center">
              <p className="text-xs font-semibold text-violet-500 uppercase">{p.years} anos</p>
              <p className="text-base font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                {formatBRL.format(p.FV)}
              </p>
              <p className="text-xs text-violet-400 mt-0.5">
                ~{p.annualEquivalent.toFixed(1)}% a.a.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Gemini AI */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">✨</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Análise com Gemini AI</h3>
        </div>

        {!geminiApiKey ? (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
            Configure sua API key do Gemini nas{' '}
            <a href="/settings" className="underline font-medium">Configurações</a>.
          </div>
        ) : (
          <>
            <button
              onClick={handleGeminiAnalysis}
              disabled={geminiLoading || !pctValid}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
            >
              {geminiLoading ? 'Analisando...' : 'Analisar com Gemini'}
            </button>
            {!pctValid && (
              <p className="text-xs text-red-500 mt-1">Ajuste a soma da carteira para 100% antes de analisar.</p>
            )}

            {geminiError && (
              <div className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-100 dark:border-red-800">
                Erro: {geminiError}
              </div>
            )}

            {geminiAnalysis && (
              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Análise Gemini</p>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {geminiAnalysis}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
