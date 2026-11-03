import { useState } from 'react';
import { Activity, CalendarCheck, Repeat, UserCheck, UserX } from 'lucide-react';
import { analyticsResource } from '../../lib/api/resources/analytics';
import { useAsync } from '../../lib/useAsync';
import { num, pct } from '../../lib/format';
import { AsyncView, Card, EmptyState, PageHeader, Stat } from '../../components/ui';
import { CHART_COLORS, HBarChart, TrendChart } from '../../components/charts';

const RANGES = [30, 90];
const SERIES = [
  { key: 'dau', label: 'Por dia', color: CHART_COLORS.emerald },
  { key: 'wau', label: 'Por semana', color: CHART_COLORS.sky },
  { key: 'mau', label: 'Por mês', color: CHART_COLORS.violet },
];
const FEATURES = {
  chat: 'Conversa com o Elio',
  transactions: 'Lançamentos',
  imports: 'Extrato importado',
  bills: 'Contas a pagar',
  planner: 'Planejamento',
  budgets: 'Orçamento',
  rules: 'Regras de categoria',
  investments: 'Investimentos',
  summary: 'Resumo recebido',
  push: 'Notificações ativadas',
};
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ratio = (a, b) => (b > 0 ? a / b : null);

function FunnelRow({ label, value, base, hint }) {
  const share = ratio(value, base);
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1 gap-3">
        <span className="text-gray-300">{label}{hint && <span className="text-gray-500 text-xs"> · {hint}</span>}</span>
        <span className="text-white font-semibold whitespace-nowrap">{num(value)} <span className="text-gray-500 font-normal">{share === null ? '' : pct(share, 0)}</span></span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share === null ? 0 : Math.max(2, Math.round(share * 100))}%` }} />
      </div>
    </div>
  );
}

function weekLabel(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function CohortTable({ cohorts }) {
  if (!cohorts.length) return <EmptyState title="Sem coortes ainda" description="Aparecem quando houver cadastros nas últimas 12 semanas." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left font-semibold px-2 py-1.5">Semana do cadastro</th>
            <th className="text-right font-semibold px-2 py-1.5">Pessoas</th>
            {Array.from({ length: 9 }, (_, k) => <th key={k} className="font-semibold px-1 py-1.5 text-center">S{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.week}>
              <td className="px-2 py-1 text-gray-300 whitespace-nowrap">{weekLabel(c.week)}</td>
              <td className="px-2 py-1 text-right text-gray-400">{num(c.size)}</td>
              {c.retained.map((r, k) => {
                const share = r === null ? null : ratio(r, c.size);
                return (
                  <td key={k} className="px-0.5 py-0.5">
                    <div
                      className="rounded text-center py-1 text-[11px] font-medium"
                      style={share === null ? undefined : { background: `rgba(16,185,129,${0.1 + share * 0.75})`, color: share > 0.45 ? '#fff' : '#d1d5db' }}
                      title={share === null ? '' : `${r} de ${c.size}`}
                    >
                      {share === null ? '' : pct(share, 0)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-500 mt-2">S0 é a semana do cadastro; S1, a semana seguinte, e assim por diante. Cada célula é a parte da turma que fez algo no app naquela semana.</p>
    </div>
  );
}

function Heatmap({ cells }) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const c of cells) {
    grid[c.dow][c.hour] = c.n;
    max = Math.max(max, c.n);
  }
  if (!max) return <EmptyState title="Sem mensagens no período" description="Aparece quando houver conversas com o Elio nos últimos 30 dias." />;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '32px repeat(24, minmax(0, 1fr))' }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-[10px] text-gray-500 text-center">{h % 3 === 0 ? h : ''}</span>)}
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="text-[11px] text-gray-500 self-center">{DAYS[d]}</span>
              {row.map((n, h) => (
                <div key={h} className="h-5 rounded-sm" title={`${DAYS[d]} ${h}h: ${n} mensagens`} style={{ background: n ? `rgba(167,139,250,${0.12 + (n / max) * 0.88})` : '#111827' }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">Horário de Brasília, mensagens enviadas ao Elio nos últimos 30 dias.</p>
    </div>
  );
}

export default function Engagement() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('dau');
  const state = useAsync(() => analyticsResource.engagement(days), `engagement-${days}`);

  return (
    <div>
      <PageHeader
        title="Engajamento e retenção"
        subtitle="Como as pessoas usam o app depois de entrar. Considera mensagens ao Elio, lançamentos feitos por elas ou pelo Elio e contas criadas. Horários de Brasília."
        actions={
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)} className={`px-3 h-9 rounded-lg text-sm font-medium ${days === r ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{r} dias</button>
            ))}
          </div>
        }
      />
      <AsyncView state={state}>
        {(d) => {
          const last = d.series[d.series.length - 1] ?? { dau: 0, wau: 0, mau: 0 };
          const dn = Object.fromEntries(d.dn.map((r) => [r.day, r]));
          const dnShare = (n) => (dn[n] && dn[n].eligible > 0 ? pct(dn[n].returned / dn[n].eligible, 0) : '—');
          const f = d.funnel;
          const depthRows = [
            { label: '1 dia', value: d.depth.d1 },
            { label: '2 a 3 dias', value: d.depth.d2_3 },
            { label: '4 a 7 dias', value: d.depth.d4_7 },
            { label: '8 a 14 dias', value: d.depth.d8_14 },
            { label: '15 dias ou mais', value: d.depth.d15 },
          ];
          const featureRows = d.features
            .filter((r) => FEATURES[r.feature])
            .map((r) => ({ ...r, label: FEATURES[r.feature], share: ratio(r.recent, r.base) }))
            .sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
          const active = SERIES.find((s) => s.key === metric);

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Ativos hoje" value={num(last.dau)} icon={Activity} hint={`${num(last.wau)} na semana · ${num(last.mau)} no mês`} />
                <Stat label="Frequência de uso" value={last.mau ? pct(last.dau / last.mau, 0) : '—'} icon={Repeat} hint="Ativos por dia ÷ ativos no mês" />
                <Stat label="Voltam no dia 1 / 7 / 30" value={`${dnShare(1)} · ${dnShare(7)} · ${dnShare(30)}`} icon={CalendarCheck} hint="Dos cadastros dos últimos 90 dias" />
                <Stat label="Em risco" value={num(d.depth.at_risk)} icon={UserX} tone={d.depth.at_risk ? 'text-amber-300' : 'text-white'} hint="Usavam e sumiram há mais de 14 dias" />
              </div>

              <Card
                title="Pessoas ativas"
                subtitle="Quantas pessoas fizeram algo no app"
                actions={
                  <div className="flex gap-1">
                    {SERIES.map((s) => (
                      <button key={s.key} onClick={() => setMetric(s.key)} className={`px-2.5 h-8 rounded-md text-xs font-medium ${metric === s.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>{s.label}</button>
                    ))}
                  </div>
                }
              >
                <TrendChart data={d.series} valueKey={metric} color={active.color} valueFormatter={num} name={`ativos ${active.label.toLowerCase()}`} />
              </Card>

              <Card title="Retenção por turma de cadastro" subtitle="Das pessoas que entraram em cada semana, quantas continuam usando">
                <CohortTable cohorts={d.cohorts} />
              </Card>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card title="Do cadastro ao hábito" subtitle={`Quem se cadastrou nos últimos ${d.days} dias`}>
                  {f.signups === 0 ? (
                    <EmptyState title="Sem cadastros no período" />
                  ) : (
                    <div className="space-y-3">
                      <FunnelRow label="Cadastraram" value={f.signups} base={f.signups} />
                      <FunnelRow label="Falaram com o Elio" value={f.chatted} base={f.signups} />
                      <FunnelRow label="Têm lançamentos" value={f.has_transactions} base={f.signups} />
                      <FunnelRow label="Importaram um extrato" value={f.imported} base={f.signups} />
                      <FunnelRow label="Voltaram em outro dia" value={f.returned} base={f.signups} hint="2 dias ou mais" />
                      <FunnelRow label="Viraram hábito" value={f.habit} base={f.signups} hint="4 dias ou mais" />
                      <FunnelRow label="Assinam ou têm acesso vitalício" value={f.paying} base={f.signups} />
                    </div>
                  )}
                </Card>

                <Card title="Quantos dias cada pessoa voltou" subtitle="Últimos 30 dias, quem esteve ativo">
                  <HBarChart data={depthRows} color={CHART_COLORS.sky} valueFormatter={num} />
                  <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" />Quanto mais à direita, mais a pessoa usa o app no dia a dia.</p>
                </Card>
              </div>

              <Card title="Recursos mais usados" subtitle="Quem, entre os ativos dos últimos 30 dias, usou cada recurso nesse período">
                {featureRows.length === 0 ? (
                  <EmptyState title="Sem dados de uso" />
                ) : (
                  <div className="space-y-3">
                    {featureRows.map((r) => (
                      <div key={r.feature}>
                        <div className="flex items-center justify-between text-sm mb-1 gap-3">
                          <span className="text-gray-300">{r.label}</span>
                          <span className="text-white font-semibold whitespace-nowrap">{r.share === null ? '—' : pct(r.share, 0)} <span className="text-gray-500 font-normal">{num(r.recent)} pessoas · {num(r.ever)} já usaram</span></span>
                        </div>
                        <div className="h-2.5 rounded-full bg-gray-800 overflow-hidden"><div className="h-full rounded-full bg-violet-400" style={{ width: `${r.share === null ? 0 : Math.max(2, Math.round(r.share * 100))}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Quando conversam com o Elio" subtitle="Dia da semana e hora">
                <Heatmap cells={d.heat} />
              </Card>

              <p className="text-xs text-gray-500">O app ainda não registra estado ou cidade das pessoas, então não há quebra por região. Posso começar a guardar isso se você quiser.</p>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}
