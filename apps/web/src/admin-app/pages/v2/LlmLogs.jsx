import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ScrollText, X } from 'lucide-react';
import { llmLogsResource } from '../../lib/api/resources/llmLogs';
import { toPage } from '../../lib/api/query';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { dateTime, ms, num, pct, usd } from '../../lib/format';
import {
  AsyncView, Badge, Button, Card, EmptyState, Field, PageHeader, Pagination, Stat, TableWrap, inputClass, tdClass, thClass,
} from '../../components/ui';
import { CHART_COLORS, HBarChart, TrendChart } from '../../components/charts';

const PAGE_SIZE = 25;
const EMPTY = { userEmail: '', model: '', purpose: '', status: '', from: '', to: '', minCostUsd: '', q: '' };

// Quick ranges like Google/Firebase Analytics. Hours are rolling windows; day ranges count calendar days up to today.
const PRESETS = [
  { key: '1h', label: '1 hora', hours: 1 },
  { key: '2h', label: '2 horas', hours: 2 },
  { key: '6h', label: '6 horas', hours: 6 },
  { key: '12h', label: '12 horas', hours: 12 },
  { key: '24h', label: '24 horas', hours: 24 },
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias', days: 7 },
  { key: '15d', label: '15 dias', days: 15 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 },
  { key: '365d', label: '1 ano', days: 365 },
  { key: 'custom', label: 'Personalizado' },
];
const GRANULARITIES = [
  { key: 'auto', label: 'Automática' },
  { key: '5m', label: '5 minutos' },
  { key: '15m', label: '15 minutos' },
  { key: 'hour', label: '1 hora' },
  { key: 'day', label: '1 dia' },
];
const GRANULARITY_NAME = { '5m': 'por 5 minutos', '15m': 'por 15 minutos', hour: 'por hora', day: 'por dia' };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO bounds for a preset (`to` is empty when the range runs up to now). */
function presetRange(key, now = new Date()) {
  const preset = PRESETS.find((p) => p.key === key);
  if (!preset || key === 'custom') return { from: '', to: '' };
  if (key === 'today') return { from: startOfToday().toISOString(), to: '' };
  if (key === 'yesterday') {
    const today = startOfToday();
    return { from: new Date(today.getTime() - 86400000).toISOString(), to: today.toISOString() };
  }
  if (preset.hours) return { from: new Date(now.getTime() - preset.hours * 3600000).toISOString(), to: '' };
  return { from: new Date(startOfToday().getTime() - (preset.days - 1) * 86400000).toISOString(), to: '' };
}

/** A sensible chart step for how long the range is. */
function autoGranularity(from, to) {
  const start = from ? new Date(from).getTime() : Date.now() - 30 * 86400000;
  const hours = ((to ? new Date(to).getTime() : Date.now()) - start) / 3600000;
  if (hours <= 3) return '5m';
  if (hours <= 12) return '15m';
  if (hours <= 72) return 'hour';
  return 'day';
}

function Summary({ from, to, granularity }) {
  const state = useAsync(() => llmLogsResource.summary({ from, to, granularity }), `${from}|${to}|${granularity}`);
  return (
    <AsyncView state={state} isEmpty={(d) => !d}>
      {(raw) => {
        const s = { ...raw, byDay: (raw.byDay ?? []).map((d) => ({ ...d, totalTokens: d.inputTokens + d.outputTokens })) };
        const step = GRANULARITY_NAME[s.granularity] ?? 'por dia';
        return (
        <div className="space-y-4">
          {/* Each point is stamped with its own bucket; add the token total so one chart can show it. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Custo total" value={usd(s.totalCostUsd)} tone="text-violet-300" />
            <Stat label="Chamadas" value={num(s.calls)} />
            <Stat label="Taxa de erro" value={pct(s.errorRate)} hint={`${num(s.errors)} erros`} tone={Number(s.errorRate) > 0.05 ? 'text-red-400' : 'text-white'} />
            <Stat label="Latência média" value={ms(s.avgLatencyMs)} />
            <Stat label="Latência p95" value={ms(s.p95LatencyMs)} />
            <Stat label="Tokens usados" value={num(Number(s.inputTokens) + Number(s.outputTokens))} hint={`${num(s.inputTokens)} entrada · ${num(s.outputTokens)} saída`} tone="text-sky-300" />
            <Stat label="Tokens por chamada" value={num(s.tokensPerCall)} hint="média entre entrada e saída" />
            <Stat label="Cache de prompt" value={pct(s.cacheHitRate)} hint={`${num(s.cachedTokens)} tokens em cache`} tone={Number(s.cacheHitRate) < 0.3 ? 'text-amber-400' : 'text-emerald-400'} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title={`Custo ${step}`}>
              <TrendChart data={s.byDay} valueKey="costUsd" color={CHART_COLORS.violet} valueFormatter={(v) => usd(v)} height={180} />
            </Card>
            <Card title={`Chamadas ${step}`}>
              <TrendChart data={s.byDay} valueKey="calls" color={CHART_COLORS.sky} name="chamadas" valueFormatter={(v) => num(v)} height={180} />
            </Card>
            <Card title={`Tokens ${step}`}>
              <TrendChart data={s.byDay} valueKey="totalTokens" color={CHART_COLORS.violet} name="tokens" valueFormatter={(v) => num(v)} height={180} />
            </Card>
            <Card title="Custo por modelo">
              {(s.byModel ?? []).length ? (
                <HBarChart data={s.byModel.map((m) => ({ label: m.model, value: Number(m.costUsd) || 0 }))} color={CHART_COLORS.violet} valueFormatter={(v) => usd(v)} />
              ) : <EmptyState title="Sem dados" />}
            </Card>
            <Card title="Custo por finalidade">
              {(s.byPurpose ?? []).length ? (
                <HBarChart data={s.byPurpose.map((m) => ({ label: m.purpose ?? m.model, value: Number(m.costUsd) || 0 }))} color={CHART_COLORS.emerald} valueFormatter={(v) => usd(v)} />
              ) : <EmptyState title="Sem dados" />}
            </Card>
          </div>
          <Card title="Maiores consumidores" padded={false}>
            {(s.topUsers ?? []).length === 0 ? <EmptyState title="Sem dados" /> : (
              <div className="px-3 sm:px-4 pb-3">
                <TableWrap>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className={thClass}>Usuário</th>
                        <th className={`${thClass} text-right`}>Chamadas</th>
                        <th className={`${thClass} text-right`}>Custo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {s.topUsers.map((u, i) => (
                        <tr key={u.userId ?? i}>
                          <td className={tdClass}>
                            {u.userId ? <Link className="text-emerald-400 hover:underline" to={`/users/${u.userId}`}>{u.email ?? u.userId}</Link> : (u.email ?? '—')}
                          </td>
                          <td className={`${tdClass} text-right`}>{num(u.calls)}</td>
                          <td className={`${tdClass} text-right`}>{usd(u.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            )}
          </Card>
        </div>
        );
      }}
    </AsyncView>
  );
}

export default function LlmLogs() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState('30d');
  const [granularity, setGranularity] = useState('auto');
  // Rolling windows move with the clock; keep the bounds fixed until a range is picked again so the data does not refetch on every render.
  const [bounds, setBounds] = useState(() => presetRange('30d'));
  const debounced = useDebounced(filters);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const pick = (key) => {
    setPreset(key);
    setBounds(presetRange(key));
    setPage(1);
  };

  useEffect(() => { setPage(1); }, [debounced]);

  // Custom range: `to` is a day, so send the end of that day to include it.
  const custom = preset === 'custom';
  const apiFilters = {
    userEmail: debounced.userEmail.trim(),
    model: debounced.model.trim(),
    purpose: debounced.purpose.trim(),
    status: debounced.status,
    from: custom ? (debounced.from ? new Date(`${debounced.from}T00:00:00`).toISOString() : '') : bounds.from,
    to: custom ? (debounced.to ? new Date(`${debounced.to}T23:59:59.999`).toISOString() : '') : bounds.to,
    minCostUsd: debounced.minCostUsd.trim().replace(',', '.'),
    q: debounced.q.trim(),
  };
  const chartStep = granularity === 'auto' ? autoGranularity(apiFilters.from, apiFilters.to) : granularity;
  const params = { ...apiFilters, page, pageSize: PAGE_SIZE };
  const list = useAsync(() => llmLogsResource.list(params), JSON.stringify(params));
  const hasFilters = JSON.stringify({ ...filters, from: '', to: '' }) !== JSON.stringify(EMPTY);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Logs de IA"
        subtitle="Cada chamada ao modelo: quem, qual modelo, quanto custou e se deu erro."
        actions={(
          <a
            href={llmLogsResource.exportUrl(apiFilters)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-3.5 py-2 text-sm font-medium text-gray-100"
            download
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </a>
        )}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => pick(p.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${preset === p.key ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Granularidade do gráfico">
            <select className={inputClass} value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              {GRANULARITIES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </Field>
          {custom && (
            <>
              <Field label="De"><input className={inputClass} type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></Field>
              <Field label="Até"><input className={inputClass} type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></Field>
            </>
          )}
        </div>
      </Card>

      <Summary from={apiFilters.from} to={apiFilters.to} granularity={chartStep} />

      <Card title="Chamadas" padded={false}>
        <div className="p-3 sm:p-4 border-b border-gray-800 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Usuário (e-mail)"><input className={inputClass} value={filters.userEmail} onChange={(e) => set({ userEmail: e.target.value })} placeholder="nome@email.com" /></Field>
            <Field label="Modelo"><input className={inputClass} value={filters.model} onChange={(e) => set({ model: e.target.value })} placeholder="ex.: gemini" /></Field>
            <Field label="Finalidade"><input className={inputClass} value={filters.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="ex.: chat" /></Field>
            <Field label="Status">
              <select className={inputClass} value={filters.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="">Todos</option>
                <option value="ok">Sucesso</option>
                <option value="error">Erro</option>
              </select>
            </Field>
            <Field label="Custo mínimo (US$)"><input className={inputClass} inputMode="decimal" value={filters.minCostUsd} onChange={(e) => set({ minCostUsd: e.target.value })} placeholder="0.01" /></Field>
            <Field label="Buscar em erro/modelo"><input className={inputClass} value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="texto" /></Field>
          </div>
          {hasFilters && (
            <Button size="sm" variant="ghost" icon={X} onClick={() => setFilters((f) => ({ ...EMPTY, from: f.from, to: f.to }))}>Limpar filtros</Button>
          )}
        </div>

        <div className="px-3 sm:px-4 pb-4">
          <AsyncView
            state={list}
            isEmpty={(d) => toPage(d).items.length === 0}
            empty={<EmptyState icon={ScrollText} title="Nenhuma chamada encontrada" description="Ajuste os filtros ou o período." />}
          >
            {(data) => {
              const p = toPage(data, PAGE_SIZE);
              return (
                <>
                  <TableWrap>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className={thClass}>Quando</th>
                          <th className={thClass}>Usuário</th>
                          <th className={thClass}>Finalidade</th>
                          <th className={thClass}>Modelo</th>
                          <th className={`${thClass} text-right`}>Tokens (ent./saí.)</th>
                          <th className={`${thClass} text-right`}>Custo</th>
                          <th className={`${thClass} text-right`}>Latência</th>
                          <th className={thClass}>Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {p.items.map((c) => (
                          <tr key={c.id}>
                            <td className={`${tdClass} whitespace-nowrap`}>{dateTime(c.createdAt)}</td>
                            <td className={tdClass}>
                              {c.userId
                                ? <Link className="text-emerald-400 hover:underline break-all" to={`/users/${c.userId}`}>{c.userEmail ?? c.userId}</Link>
                                : (c.userEmail ?? '—')}
                            </td>
                            <td className={tdClass}>{c.purpose ?? '—'}</td>
                            <td className={`${tdClass} whitespace-nowrap`}>{c.model ?? '—'}</td>
                            <td className={`${tdClass} text-right whitespace-nowrap`}>
                              {num(c.inputTokens)} / {num(c.outputTokens)}
                              {c.cachedInputTokens ? <span className="block text-[10px] text-gray-500">{num(c.cachedInputTokens)} em cache</span> : null}
                            </td>
                            <td className={`${tdClass} text-right whitespace-nowrap`}>{usd(c.costUsd, 5)}</td>
                            <td className={`${tdClass} text-right whitespace-nowrap`}>{ms(c.latencyMs)}</td>
                            <td className={tdClass}>
                              {c.error
                                ? <span title={c.error}><Badge tone="red">Erro</Badge><span className="block text-[10px] text-red-300/80 mt-0.5 max-w-[200px] truncate">{c.error}</span></span>
                                : <Badge tone="green">OK</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                  <Pagination page={p.page} pageSize={p.pageSize} total={p.total} onChange={setPage} />
                </>
              );
            }}
          </AsyncView>
        </div>
      </Card>
    </div>
  );
}
