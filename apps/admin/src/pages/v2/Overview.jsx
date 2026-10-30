import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bot, CreditCard, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import { analyticsResource } from '../../lib/api/resources/analytics';
import { useAsync } from '../../lib/useAsync';
import { brl, num, pct, usd } from '../../lib/format';
import { AsyncView, Badge, Card, EmptyState, PageHeader, Stat, TableWrap, tdClass, thClass } from '../../components/ui';
import { CHART_COLORS, HBarChart, TrendChart } from '../../components/charts';

const RANGES = [7, 30, 90];

function FunnelRow({ label, value, base, tone }) {
  const width = base > 0 ? Math.max(2, Math.round((value / base) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-white font-semibold">{num(value)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function TopUsers() {
  const state = useAsync(() => analyticsResource.usersUsage({ sort: 'cost', limit: 8 }), 'top');
  return (
    <Card title="Usuários que mais usam IA" subtitle="Ordenado por custo no período" padded={false}>
      <AsyncView
        state={state}
        isEmpty={(d) => !(Array.isArray(d) ? d : d?.items)?.length}
        empty={<EmptyState title="Sem dados de uso" description="Quando houver consumo de IA, os maiores usuários aparecem aqui." />}
      >
        {(data) => {
          const rows = Array.isArray(data) ? data : data.items;
          return (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className={thClass}>Usuário</th>
                    <th className={`${thClass} text-right`}>Custo</th>
                    <th className={`${thClass} text-right`}>Mensagens</th>
                    <th className={`${thClass} text-right`}>Importações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((r, i) => (
                    <tr key={r.userId ?? r.id ?? i}>
                      <td className={tdClass}>
                        {r.userId ?? r.id
                          ? <Link className="text-emerald-400 hover:underline" to={`/users/${r.userId ?? r.id}`}>{r.email ?? r.userId}</Link>
                          : (r.email ?? '—')}
                      </td>
                      <td className={`${tdClass} text-right`}>{usd(r.costUsd ?? r.aiCostUsd)}</td>
                      <td className={`${tdClass} text-right`}>{num(r.messages ?? r.chatMessages ?? 0)}</td>
                      <td className={`${tdClass} text-right`}>{num(r.imports ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          );
        }}
      </AsyncView>
    </Card>
  );
}

/** Revenue against what it costs to serve it: what is left after payment fees and the AI, per month. */
function ResultCard({ f }) {
  const a = f.assumptions ?? {};
  const revenue = f.mrrCents ?? 0;
  const net = f.netCents ?? 0;
  const positive = net >= 0;
  const share = (cents) => (revenue > 0 ? Math.min(100, Math.max(0, (cents / revenue) * 100)) : 0);
  const row = (label, hint, value, tone = 'text-white') => (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-gray-400">{label}{hint && <span className="block text-xs text-gray-500">{hint}</span>}</dt>
      <dd className={`font-medium tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
  return (
    <Card title="Resultado do mês" subtitle="Quanto sobra da receita depois das taxas e da IA (estimativa mensal)">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <dl className="space-y-3 text-sm">
          {row('Receita recorrente (MRR)', 'o que os assinantes realmente pagam, com descontos', brl(revenue), 'text-emerald-400')}
          {row('Taxas do Stripe', `estimadas: ${a.feePct}% + ${brl(a.feeFixedCents)} por cobrança`, `− ${brl(f.feeCents)}`, 'text-amber-300')}
          {row('Custo de IA', `média dos últimos ${a.windowDays} dias, para 30 dias · câmbio R$ ${Number(a.usdBrl).toFixed(2).replace('.', ',')}`, `− ${brl(f.aiCostCents)}`, 'text-violet-300')}
          <div className="border-t border-gray-800 pt-3">
            {row('Resultado líquido', f.margin == null ? 'sem receita ainda' : `${pct(f.margin)} da receita`, brl(net), positive ? 'text-emerald-400 text-lg' : 'text-red-400 text-lg')}
          </div>
        </dl>
        <div>
          {revenue > 0 ? (
            <>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-800" role="img" aria-label="Divisão da receita">
                <div className="bg-violet-500" style={{ width: `${share(f.aiCostCents)}%` }} title="IA" />
                <div className="bg-amber-500" style={{ width: `${share(f.feeCents)}%` }} title="Taxas" />
                <div className="bg-emerald-500" style={{ width: `${positive ? share(net) : 0}%` }} title="Sobra" />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-500" />IA {pct(f.aiShareOfRevenue)}</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Taxas {pct(revenue ? f.feeCents / revenue : 0)}</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Sobra {pct(positive && revenue ? net / revenue : 0)}</span>
              </div>
              <p className="mt-3 text-sm text-gray-300">
                {positive
                  ? `A cada R$ 1,00 recebido, sobram R$ ${(Math.max(0, net) / revenue).toFixed(2).replace('.', ',')} depois da IA e das taxas.`
                  : `A IA e as taxas custam mais do que a receita: faltam ${brl(-net)} por mês para empatar.`}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Quando houver assinaturas pagas, aparece aqui quanto da receita fica depois da IA e das taxas.</p>
          )}
          <p className="mt-3 text-xs text-gray-500">O custo de IA inclui todos os usuários (também quem está no teste ou usa de graça). Ajuste câmbio e taxas pelas variáveis ADMIN_USD_BRL, ADMIN_STRIPE_FEE_PCT e ADMIN_STRIPE_FEE_FIXED_CENTS.</p>
        </div>
      </div>
    </Card>
  );
}

function Dashboard({ data, days }) {
  const u = data.users ?? {};
  const f = data.funnel ?? {};
  const r = data.revenue ?? {};
  const ai = data.ai ?? {};
  const usage = data.usage ?? {};
  const s = data.series ?? {};
  const h = data.health ?? {};
  const errorRate24 = Number(h.llmErrorRateLast24h ?? 0);
  const healthTone = errorRate24 >= 0.1 ? 'red' : errorRate24 >= 0.03 ? 'amber' : 'green';
  const funnelBase = Math.max(f.signups ?? 0, 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Usuários" value={num(u.total)} hint={`+${num(u.new)} nos últimos ${days} dias`} icon={Users} />
        <Stat label="Ativos no mês (MAU)" value={num(u.mau)} hint={`${num(u.dau)} por dia · ${num(u.wau)} por semana`} icon={Activity} />
        <Stat label="MRR" value={brl(r.mrrCents)} hint={r.listMrrCents > r.mrrCents ? `ARR ${brl(r.arrCents)} · ${brl(r.listMrrCents)} sem descontos` : `ARR ${brl(r.arrCents)}`} icon={Wallet} tone="text-emerald-400" />
        <Stat label="Custo de IA" value={usd(ai.costUsd)} hint={`${usd(ai.costPerActiveUserUsd)} por usuário ativo`} icon={Bot} tone="text-violet-300" />
      </div>

      {data.finance && <ResultCard f={data.finance} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Em teste" value={num(u.trial)} icon={UserPlus} />
        <Stat label="Assinantes" value={num(u.subscribed)} hint={`${num(r.monthly)} mensais · ${num(r.annual)} anuais`} icon={CreditCard} />
        <Stat label="Vitalícios" value={num(u.lifetime)} hint={`${num(u.blocked)} bloqueados`} icon={Users} />
        <Stat label="Conversão" value={pct(f.conversionRate)} hint={`${num(f.converted)} de ${num(f.signups)} cadastros`} icon={TrendingUp} tone="text-sky-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Novos cadastros" subtitle={`Por dia, últimos ${days} dias`}>
          <TrendChart data={s.signups} valueKey="count" name="cadastros" valueFormatter={(v) => num(v)} />
        </Card>
        <Card title="Usuários ativos" subtitle="Por dia">
          <TrendChart data={s.activeUsers} valueKey="count" color={CHART_COLORS.sky} name="ativos" valueFormatter={(v) => num(v)} />
        </Card>
        <Card title="Custo de IA" subtitle="Por dia, em dólares">
          <TrendChart data={s.aiCostUsd} valueKey="costUsd" color={CHART_COLORS.violet} name="" valueFormatter={(v) => usd(v)} />
        </Card>
        <Card title="Funil de conversão" subtitle="Do cadastro à assinatura">
          <div className="space-y-3.5">
            <FunnelRow label="Cadastros" value={f.signups ?? 0} base={funnelBase} tone="bg-sky-500" />
            <FunnelRow label="Ativados (importou ou conversou)" value={f.activated ?? 0} base={funnelBase} tone="bg-emerald-500" />
            <FunnelRow label="Em teste" value={f.trialing ?? 0} base={funnelBase} tone="bg-amber-500" />
            <FunnelRow label="Converteram" value={f.converted ?? 0} base={funnelBase} tone="bg-violet-500" />
            <FunnelRow label="Teste expirado" value={f.expired ?? 0} base={funnelBase} tone="bg-red-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Receita recorrente">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-400">Assinaturas ativas</dt><dd className="text-white font-medium">{num(r.activeSubscriptions)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Mensais</dt><dd className="text-white font-medium">{num(r.monthly)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Anuais</dt><dd className="text-white font-medium">{num(r.annual)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">MRR</dt><dd className="text-emerald-400 font-semibold">{brl(r.mrrCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">ARR</dt><dd className="text-white font-medium">{brl(r.arrCents)}</dd></div>
            {r.listMrrCents > r.mrrCents && (
              <div className="flex justify-between"><dt className="text-gray-400">MRR sem descontos</dt><dd className="text-gray-300">{brl(r.listMrrCents)}</dd></div>
            )}
          </dl>
        </Card>
        <Card title="Uso no período">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-400">Importações</dt><dd className="text-white font-medium">{num(usage.imports)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Transações criadas</dt><dd className="text-white font-medium">{num(usage.transactionsCreated)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Mensagens no chat</dt><dd className="text-white font-medium">{num(usage.chatMessages)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Chamadas de IA</dt><dd className="text-white font-medium">{num(ai.calls)}</dd></div>
          </dl>
        </Card>
        <Card title="Saúde da IA" actions={<Badge tone={healthTone}>{healthTone === 'green' ? 'Saudável' : healthTone === 'amber' ? 'Atenção' : 'Crítico'}</Badge>}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-400">Chamadas (24 h)</dt><dd className="text-white font-medium">{num(h.llmCallsLast24h)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Taxa de erro (24 h)</dt><dd className="text-white font-medium">{pct(h.llmErrorRateLast24h)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Taxa de erro (período)</dt><dd className="text-white font-medium">{pct(ai.errorRate)}</dd></div>
          </dl>
          <Link to="/ai-logs" className="inline-block mt-3 text-xs text-emerald-400 hover:underline">Ver logs de IA</Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Custo por modelo" subtitle="No período">
          {(ai.byModel ?? []).length === 0 ? (
            <EmptyState title="Sem chamadas de IA no período" />
          ) : (
            <HBarChart
              data={ai.byModel.map((m) => ({ label: m.model, value: Number(m.costUsd) || 0 }))}
              color={CHART_COLORS.violet}
              valueFormatter={(v) => usd(v)}
            />
          )}
        </Card>
        <TopUsers />
      </div>
    </div>
  );
}

export default function Overview() {
  const [days, setDays] = useState(30);
  const state = useAsync(() => analyticsResource.overview(days), String(days));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Visão geral"
        subtitle="Crescimento, receita, uso e custo de IA do Realwise."
        actions={(
          <div className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-0.5" role="group" aria-label="Período">
            {RANGES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${days === d ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {d} dias
              </button>
            ))}
          </div>
        )}
      />
      <AsyncView state={state} isEmpty={(d) => !d}>
        {(data) => <Dashboard data={data} days={days} />}
      </AsyncView>
    </div>
  );
}
