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

function Summary({ from, to }) {
  const state = useAsync(() => llmLogsResource.summary({ from, to }), `${from}|${to}`);
  return (
    <AsyncView state={state} isEmpty={(d) => !d}>
      {(s) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Custo total" value={usd(s.totalCostUsd)} tone="text-violet-300" />
            <Stat label="Chamadas" value={num(s.calls)} />
            <Stat label="Taxa de erro" value={pct(s.errorRate)} hint={`${num(s.errors)} erros`} tone={Number(s.errorRate) > 0.05 ? 'text-red-400' : 'text-white'} />
            <Stat label="Latência média" value={ms(s.avgLatencyMs)} />
            <Stat label="Latência p95" value={ms(s.p95LatencyMs)} />
            <Stat label="Tokens por chamada" value={num(s.tokensPerCall)} hint={`${num(s.inputTokens)} entrada · ${num(s.outputTokens)} saída`} />
            <Stat label="Cache de prompt" value={pct(s.cacheHitRate)} hint={`${num(s.cachedTokens)} tokens em cache`} tone={Number(s.cacheHitRate) < 0.3 ? 'text-amber-400' : 'text-emerald-400'} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Custo por dia">
              <TrendChart data={s.byDay} valueKey="costUsd" color={CHART_COLORS.violet} valueFormatter={(v) => usd(v)} height={180} />
            </Card>
            <Card title="Chamadas por dia">
              <TrendChart data={s.byDay} valueKey="calls" color={CHART_COLORS.sky} name="chamadas" valueFormatter={(v) => num(v)} height={180} />
            </Card>
            <Card title="Tokens por dia (entrada)">
              <TrendChart data={s.byDay} valueKey="inputTokens" color={CHART_COLORS.violet} name="tokens" valueFormatter={(v) => num(v)} height={180} />
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
      )}
    </AsyncView>
  );
}

export default function LlmLogs() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const debounced = useDebounced(filters);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  useEffect(() => { setPage(1); }, [debounced]);

  // `to` is a day: send the end of that day so the day itself is included.
  const apiFilters = {
    userEmail: debounced.userEmail.trim(),
    model: debounced.model.trim(),
    purpose: debounced.purpose.trim(),
    status: debounced.status,
    from: debounced.from ? new Date(`${debounced.from}T00:00:00`).toISOString() : '',
    to: debounced.to ? new Date(`${debounced.to}T23:59:59.999`).toISOString() : '',
    minCostUsd: debounced.minCostUsd.trim().replace(',', '.'),
    q: debounced.q.trim(),
  };
  const params = { ...apiFilters, page, pageSize: PAGE_SIZE };
  const list = useAsync(() => llmLogsResource.list(params), JSON.stringify(params));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY);

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

      <Summary from={apiFilters.from} to={apiFilters.to} />

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
            <Field label="De"><input className={inputClass} type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></Field>
            <Field label="Até"><input className={inputClass} type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></Field>
            <Field label="Custo mínimo (US$)"><input className={inputClass} inputMode="decimal" value={filters.minCostUsd} onChange={(e) => set({ minCostUsd: e.target.value })} placeholder="0.01" /></Field>
            <Field label="Buscar em erro/modelo"><input className={inputClass} value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="texto" /></Field>
          </div>
          {hasFilters && (
            <Button size="sm" variant="ghost" icon={X} onClick={() => setFilters(EMPTY)}>Limpar filtros</Button>
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
