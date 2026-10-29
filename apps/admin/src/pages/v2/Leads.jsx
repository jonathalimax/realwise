import { useMemo, useState } from 'react';
import { Download, Eye, MousePointerClick, TrendingUp, UserPlus, Users } from 'lucide-react';
import { landingResource } from '../../lib/api/resources/landing';
import { useAsync } from '../../lib/useAsync';
import { date, num, pct } from '../../lib/format';
import { AsyncView, Badge, Button, Card, EmptyState, PageHeader, Stat, TableWrap, inputClass, tdClass, thClass } from '../../components/ui';
import { CHART_COLORS, TrendChart } from '../../components/charts';

const RANGES = [7, 30, 90];

function csv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const head = ['email', 'telefone', 'consentimento', 'origem', 'criado_em'];
  const body = rows.map((l) => [l.email, l.phone, l.marketingConsent ? 'sim' : 'não', l.source, l.createdAt].map(cell).join(','));
  return [head.join(','), ...body].join('\n');
}

function download(rows) {
  const blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function LeadsTable() {
  const state = useAsync(() => landingResource.listLeads(), 'leads');
  const [search, setSearch] = useState('');
  const [onlyConsent, setOnlyConsent] = useState(true);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (state.data ?? []).filter((l) => (!onlyConsent || l.marketingConsent) && (!q || `${l.email} ${l.phone ?? ''}`.toLowerCase().includes(q)));
  }, [state.data, search, onlyConsent]);

  return (
    <Card
      title="Leads"
      subtitle="Pessoas que deixaram o contato na página inicial"
      actions={<Button icon={Download} size="sm" disabled={!rows.length} onClick={() => download(rows)}>Exportar CSV</Button>}
      padded={false}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3">
        <input className={`${inputClass} max-w-xs`} placeholder="Buscar e-mail ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={onlyConsent} onChange={(e) => setOnlyConsent(e.target.checked)} />
          Só quem aceitou receber novidades
        </label>
      </div>
      <AsyncView
        state={state}
        isEmpty={() => rows.length === 0}
        empty={<EmptyState title="Nenhum lead ainda" description="Quando alguém preencher o formulário “Quer ficar por dentro?” da página inicial, aparece aqui." />}
      >
        {() => (
          <TableWrap>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className={thClass}>E-mail</th>
                  <th className={thClass}>WhatsApp</th>
                  <th className={thClass}>Origem</th>
                  <th className={thClass}>Novidades</th>
                  <th className={thClass}>Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className={tdClass}>{l.email}</td>
                    <td className={tdClass}>{l.phone ?? '—'}</td>
                    <td className={tdClass}>{l.source ?? '—'}</td>
                    <td className={tdClass}><Badge tone={l.marketingConsent ? 'green' : 'gray'}>{l.marketingConsent ? 'aceitou' : 'não'}</Badge></td>
                    <td className={tdClass}>{date(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </AsyncView>
    </Card>
  );
}

export default function Leads() {
  const [days, setDays] = useState(30);
  const state = useAsync(() => landingResource.stats(days), `stats-${days}`);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads e funil da página inicial"
        subtitle="Visitas, cliques nos botões e contatos captados"
        actions={
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Button key={r} size="sm" variant={r === days ? 'primary' : 'secondary'} onClick={() => setDays(r)}>{r} dias</Button>
            ))}
          </div>
        }
      />
      <AsyncView state={state}>
        {(s) => (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat label="Visitantes" value={num(s.visitors)} hint={`${num(s.views)} visitas`} icon={Eye} />
              <Stat label="Clicaram em um botão" value={num(s.clickers)} hint={`${num(s.ctaClicks)} cliques`} icon={MousePointerClick} tone="text-violet-300" />
              <Stat label="Taxa de clique" value={pct(s.ctr)} hint="visitantes que clicaram" icon={TrendingUp} tone="text-sky-300" />
              <Stat label="Leads captados" value={num(s.leads)} icon={UserPlus} tone="text-emerald-400" />
              <Stat label="Cadastros" value={num(s.signups)} hint="novas contas no período" icon={Users} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Visitantes por dia">
                <TrendChart data={s.perDay} valueKey="visitors" name="visitantes" valueFormatter={(v) => num(v)} />
              </Card>
              <Card title="Cliques nos botões por dia">
                <TrendChart data={s.perDay} valueKey="clicks" color={CHART_COLORS.violet} name="cliques" valueFormatter={(v) => num(v)} />
              </Card>
              <Card title="Botões mais clicados" padded={false}>
                {s.topCtas.length === 0 ? (
                  <EmptyState title="Sem cliques ainda" />
                ) : (
                  <TableWrap>
                    <table className="w-full"><tbody className="divide-y divide-gray-800">
                      {s.topCtas.map((c) => (<tr key={c.cta}><td className={tdClass}>{c.cta}</td><td className={`${tdClass} text-right`}>{num(c.count)}</td></tr>))}
                    </tbody></table>
                  </TableWrap>
                )}
              </Card>
              <Card title="De onde vêm os visitantes" padded={false}>
                {s.topSources.length === 0 ? (
                  <EmptyState title="Sem visitas ainda" />
                ) : (
                  <TableWrap>
                    <table className="w-full"><tbody className="divide-y divide-gray-800">
                      {s.topSources.map((c) => (<tr key={c.source}><td className={tdClass}>{c.source}</td><td className={`${tdClass} text-right`}>{num(c.visitors)}</td></tr>))}
                    </tbody></table>
                  </TableWrap>
                )}
              </Card>
            </div>
          </div>
        )}
      </AsyncView>
      <LeadsTable />
    </div>
  );
}
