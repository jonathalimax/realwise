import { useEffect, useRef, useState } from 'react';
import { BarChart3, Bot, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react';
import { simulatorResource } from '../../lib/api/resources/simulator';
import { friendlyError } from '../../lib/api/errors';
import { useAsync } from '../../lib/useAsync';
import { CHART_COLORS, TrendChart } from '../../components/charts';
import { AsyncView, Button, Card, Field, InlineMessage, PageHeader, inputClass } from '../../components/ui';

/** Tiny renderer for Elio's markdown: **bold**, "- " bullets and links as plain text. */
function RichText({ text }) {
  const inline = (line, key) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={`${key}-${i}`} className="font-semibold text-white">{part.slice(2, -2)}</strong> : part,
    );
  return (
    <div className="space-y-1.5 break-words">
      {String(text ?? '').split('\n').map((line, i) =>
        line.trim() === '' ? null : /^\s*[-•]\s+/.test(line) ? (
          <div key={i} className="flex gap-2"><span className="text-gray-500">•</span><span>{inline(line.replace(/^\s*[-•]\s+/, ''), i)}</span></div>
        ) : (
          <p key={i}>{inline(line, i)}</p>
        ),
      )}
    </div>
  );
}

function Bubble({ mine, children }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${mine ? 'bg-emerald-700/80 text-white rounded-br-md' : 'bg-gray-800 text-gray-200 rounded-bl-md'}`}>
        {!mine && <p className="text-[11px] font-bold text-violet-400 mb-0.5">Elio</p>}
        {children}
      </div>
    </div>
  );
}

const Chips = ({ options, onPick, disabled }) => (
  <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1" role="group" aria-label="Respostas rápidas">
    {options.map((o, i) => (
      <button
        key={o.value}
        type="button"
        disabled={disabled}
        onClick={() => onPick(o.label)}
        className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition-colors disabled:opacity-50 ${
          i === options.length - 1 ? 'border-gray-700 px-2.5 py-1 text-xs text-gray-400 hover:bg-gray-800' : 'border-violet-700 px-3.5 py-2 text-sm text-violet-300 hover:bg-violet-900/30'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** Option buttons for the sheet-style questions (which account, payment method, confirmations). */
function QuestionBlock({ message, onSubmit, disabled }) {
  const pending = (message.questions ?? []).filter((q) => !q.answer && q.kind !== 'quick' && q.kind !== 'account_form');
  const [picks, setPicks] = useState({});
  if (pending.length === 0) return null;
  const done = pending.every((q) => picks[q.id]);
  return (
    <div className="mt-2 space-y-3 rounded-xl border border-gray-700 p-3">
      {pending.map((q) => (
        <div key={q.id}>
          <p className="text-xs font-semibold text-gray-200">{q.title}</p>
          {q.subtitle && <p className="text-[11px] text-gray-500">{q.subtitle}</p>}
          {q.preview?.map((l) => <p key={l} className="text-[11px] text-gray-400">• {l}</p>)}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(q.options?.length ? q.options : [{ value: 'yes', label: 'Confirmar' }]).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPicks((p) => ({ ...p, [q.id]: { questionId: q.id, value: o.value, label: o.label } }))}
                className={`rounded-lg border px-2.5 py-1 text-xs ${picks[q.id]?.value === o.value ? 'border-emerald-500 bg-emerald-900/40 text-emerald-200' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button size="sm" variant="primary" disabled={!done || disabled} onClick={() => onSubmit(Object.values(picks))}>Enviar respostas</Button>
    </div>
  );
}

function AccountFormBlock({ message, onSubmit, disabled }) {
  const q = (message.questions ?? []).find((x) => x.kind === 'account_form' && !x.answer);
  const [form, setForm] = useState({ bankId: 'nubank', customBankName: '', cardName: '', type: 'checking', holderName: '', closingDay: '', paymentDay: '' });
  if (!q) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const credit = form.type === 'credit';
  const ok = form.holderName.trim() && (form.bankId !== 'other' || form.customBankName.trim()) && (!credit || (form.closingDay && form.paymentDay));
  return (
    <div className="mt-2 grid gap-2 rounded-xl border border-gray-700 p-3 sm:grid-cols-2">
      <p className="sm:col-span-2 text-xs font-semibold text-gray-200">{q.title}</p>
      <select className={inputClass} value={form.bankId} onChange={(e) => set({ bankId: e.target.value })}>
        {q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select className={inputClass} value={form.type} onChange={(e) => set({ type: e.target.value })}>
        <option value="checking">Conta corrente</option><option value="credit">Cartão de crédito</option>
        <option value="wallet">Carteira</option><option value="savings">Poupança</option>
      </select>
      {form.bankId === 'other' && <input className={inputClass} placeholder="Nome do banco" value={form.customBankName} onChange={(e) => set({ customBankName: e.target.value })} />}
      <input className={inputClass} placeholder="Titular" value={form.holderName} onChange={(e) => set({ holderName: e.target.value })} />
      <input className={inputClass} placeholder="Apelido do cartão (opcional)" value={form.cardName} onChange={(e) => set({ cardName: e.target.value })} />
      {credit && (
        <>
          <input className={inputClass} inputMode="numeric" placeholder="Dia do fechamento" value={form.closingDay} onChange={(e) => set({ closingDay: e.target.value })} />
          <input className={inputClass} inputMode="numeric" placeholder="Dia do vencimento" value={form.paymentDay} onChange={(e) => set({ paymentDay: e.target.value })} />
        </>
      )}
      <div className="sm:col-span-2">
        <Button size="sm" variant="primary" disabled={!ok || disabled} onClick={() => onSubmit({
          bankId: form.bankId, customBankName: form.customBankName || undefined, cardName: form.cardName || undefined, type: form.type,
          holderName: form.holderName, closingDay: credit ? Number(form.closingDay) : undefined, paymentDay: credit ? Number(form.paymentDay) : undefined,
        })}>Cadastrar</Button>
      </div>
    </div>
  );
}

function Composer({ onSend, busy, placeholder }) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onSend(t);
  };
  return (
    <div className="flex items-end gap-2">
      <textarea
        className={`${inputClass} min-h-[44px] max-h-32 flex-1 resize-none`}
        rows={1}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
      />
      <Button variant="primary" icon={Send} onClick={submit} disabled={!text.trim() || busy}>Enviar</Button>
    </div>
  );
}

function useAutoScroll(dep) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [dep]);
  return ref;
}

/** Chat with the real Elio as a throwaway user. */
function UserSimulator() {
  const state = useAsync(() => simulatorResource.messages(), 'sim-messages');
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messages = override ?? state.data ?? [];
  const endRef = useAutoScroll(messages.length + (busy ? 1 : 0));

  const last = messages[messages.length - 1];
  const chips = last?.role === 'assistant' ? last.questions?.find((q) => q.kind === 'quick' && !q.answer)?.options ?? [] : [];

  async function run(fn, optimistic) {
    setBusy(true);
    setError('');
    if (optimistic) setOverride([...messages, optimistic]);
    try {
      return await fn();
    } catch (e) {
      setError(friendlyError(e));
      if (optimistic) setOverride(messages);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const applyTurn = (turn) => {
    const base = messages.map((m) => (turn.questionsMessage && m.id === turn.questionsMessage.id ? turn.questionsMessage : m));
    setOverride([...base, turn.userMessage, turn.assistantMessage].filter(Boolean));
  };

  const send = async (text) => {
    const turn = await run(() => simulatorResource.send(text), { id: `tmp-${Date.now()}`, role: 'user', content: text });
    if (turn) applyTurn(turn);
  };
  const reset = async (interview) => {
    const rows = await run(() => simulatorResource.reset({ interview }));
    if (rows) setOverride(rows);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={Sparkles} variant="primary" onClick={() => reset(true)} disabled={busy}>Simular entrevista (usuário novo)</Button>
        <Button icon={RotateCcw} onClick={() => reset(false)} disabled={busy}>Reiniciar do zero</Button>
        <p className="text-xs text-gray-500">Usa o Elio de verdade com um usuário descartável: nada toca dados de clientes e nenhum e-mail é enviado.</p>
      </div>
      <Card padded={false}>
        <AsyncView state={state} isEmpty={() => false}>
          {() => (
            <div className="flex h-[60vh] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Conversa vazia. Escreva abaixo ou toque em “Simular entrevista”.</p>}
                {messages.map((m) => (
                  <Bubble key={m.id} mine={m.role === 'user'}>
                    <RichText text={m.content} />
                    {Array.isArray(m.saved) && m.saved.length > 0 && <p className="mt-1.5 text-[11px] text-emerald-400">✓ Transações salvas no simulador</p>}
                    {m.review?.groups?.length > 0 && !m.review.resolved && <p className="mt-1.5 text-[11px] text-amber-400">O Elio pediu confirmação de categorias (painel não disponível no simulador).</p>}
                    {m === last && (
                      <>
                        <QuestionBlock key={m.id} message={m} disabled={busy} onSubmit={async (answers) => { const t = await run(() => simulatorResource.answer(m.id, answers)); if (t) applyTurn(t); }} />
                        <AccountFormBlock key={`${m.id}-f`} message={m} disabled={busy} onSubmit={async (form) => { const t = await run(() => simulatorResource.accountForm(m.id, form)); if (t) applyTurn(t); }} />
                      </>
                    )}
                  </Bubble>
                ))}
                {busy && <p className="text-xs text-gray-500">Elio está pensando…</p>}
                <div ref={endRef} />
              </div>
              <div className="space-y-2 border-t border-gray-800 p-3">
                {chips.length > 0 && !busy && <Chips options={chips} onPick={send} />}
                {error && <InlineMessage>{error}</InlineMessage>}
                <Composer onSend={send} busy={busy} placeholder="Escreva como um usuário… ex.: gastei 45 no mercado" />
              </div>
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}

const SUGGESTIONS = [
  'Como estão nossos números dos últimos 30 dias?',
  'Qual é o nosso MRR e quanto os cupons custam?',
  'Estamos tendo retorno? Compare receita e custo de IA.',
  'Mostre um gráfico dos cadastros dos últimos 30 dias',
  'Quem mais custa em IA?',
  'Quantos testes viraram assinatura?',
];

const fmt = (unit, v) => (unit === 'usd' ? `US$ ${Number(v).toFixed(2)}` : String(Math.round(v)));

/** Business analyst: asks the real admin numbers, answers in text and charts. */
function OpsAssistant() {
  const [turns, setTurns] = useState([]); // { role, content, charts? }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useAutoScroll(turns.length + (busy ? 1 : 0));

  async function ask(text) {
    const next = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setBusy(true);
    setError('');
    try {
      const res = await simulatorResource.ops(next.map((t) => ({ role: t.role, content: t.content })));
      setTurns([...next, { role: 'assistant', content: res.reply, charts: res.charts }]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padded={false}>
      <div className="flex h-[65vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-gray-400">Pergunte sobre a operação: métricas, valores, gráficos. Os números vêm do mesmo banco do painel.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-violet-700 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-900/30">{s}</button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <Bubble key={i} mine={t.role === 'user'}>
              <RichText text={t.content} />
              {t.charts?.map((c, j) => (
                <div key={j} className="mt-3 rounded-xl bg-gray-900 p-3">
                  <p className="mb-1 text-xs font-semibold text-gray-300">{c.title}</p>
                  <TrendChart data={c.data} valueKey="value" color={c.unit === 'usd' ? CHART_COLORS.violet : CHART_COLORS.emerald} valueFormatter={(v) => fmt(c.unit, v)} name="" />
                </div>
              ))}
            </Bubble>
          ))}
          {busy && <p className="text-xs text-gray-500">Analisando os números…</p>}
          <div ref={endRef} />
        </div>
        <div className="space-y-2 border-t border-gray-800 p-3">
          {error && <InlineMessage>{error}</InlineMessage>}
          <Composer onSend={ask} busy={busy} placeholder="Ex.: qual a margem líquida este mês?" />
        </div>
      </div>
    </Card>
  );
}

const TABS = [
  { key: 'user', label: 'Conversar como usuário', icon: UserRound },
  { key: 'ops', label: 'Perguntar sobre o negócio', icon: BarChart3 },
];

export default function Simulator() {
  const [tab, setTab] = useState('user');
  return (
    <div className="space-y-4">
      <PageHeader title="Simulador do Elio" subtitle="Teste a conversa e a entrevista como um usuário, ou pergunte sobre métricas e valores do negócio." />
      <div className="flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium ${tab === t.key ? 'border-emerald-600 bg-emerald-900/30 text-emerald-200' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
          >
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>
      {tab === 'user' ? <UserSimulator /> : <OpsAssistant />}
    </div>
  );
}
