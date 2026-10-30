import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, CreditCard, ExternalLink, RefreshCw, TriangleAlert, UserMinus, Users } from 'lucide-react';
import { subscriptionsResource } from '../../lib/api/resources/subscriptions';
import { friendlyError } from '../../lib/api/errors';
import { useAsync } from '../../lib/useAsync';
import { brl, date, num } from '../../lib/format';
import { AsyncView, Badge, Button, Card, EmptyState, PageHeader, Stat, TableWrap, Toast, inputClass, tdClass, thClass } from '../../components/ui';

const FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'active', label: 'Ativas' },
  { key: 'trialing', label: 'Em teste (Stripe)' },
  { key: 'past_due', label: 'Pagamento pendente' },
  { key: 'canceling', label: 'Cancelando' },
  { key: 'canceled', label: 'Encerradas' },
];

function StatusBadge({ row }) {
  if (row.canceling) return <Badge tone="amber">Cancelando</Badge>;
  switch (row.status) {
    case 'active': return <Badge tone="green">Ativa</Badge>;
    case 'trialing': return <Badge tone="blue">Em teste</Badge>;
    case 'past_due': return <Badge tone="red">Pagamento pendente</Badge>;
    case 'unpaid': return <Badge tone="red">Não paga</Badge>;
    case 'canceled': return <Badge tone="gray">Encerrada</Badge>;
    default: return <Badge tone="gray">{row.status ?? '—'}</Badge>;
  }
}

const planLabel = (row) => {
  const name = row.plan === 'annual' ? 'Anual' : row.plan === 'monthly' ? 'Mensal' : '—';
  return row.amountCents ? `${name} · ${brl(row.amountCents)}` : name;
};

export default function Subscriptions() {
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(null);
  const [toast, setToast] = useState({ message: '', tone: 'success' });
  const state = useAsync(() => subscriptionsResource.list({ filter, q }), `${filter}|${q}`);
  const { reload } = state;
  const health = useAsync(() => subscriptionsResource.webhookHealth(), 'webhook-health');
  const [job, setJob] = useState(null);

  // Pick up a catch-up that is already running (e.g. after a page reload).
  useEffect(() => {
    let alive = true;
    subscriptionsResource.syncAllStatus().then((s) => { if (alive && s.running) setJob(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // While it runs, ask for progress every 1.5 s; when it ends, report and refresh the list.
  useEffect(() => {
    if (!job?.running) return undefined;
    const timer = setTimeout(async () => {
      try {
        const s = await subscriptionsResource.syncAllStatus();
        setJob(s);
        if (!s.running) {
          setToast({ message: `Pronto: ${s.done} conferidos, ${s.updated} atualizados${s.failed ? `, ${s.failed} com erro` : ''}.`, tone: s.failed ? 'warning' : 'success' });
          reload(true);
        }
      } catch {
        setJob(null);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [job, reload]);

  async function startSyncAll() {
    try {
      setJob(await subscriptionsResource.startSyncAll());
    } catch (e) {
      setToast({ message: friendlyError(e), tone: 'error' });
    }
  }

  async function sync(row) {
    setSyncing(row.userId);
    try {
      await subscriptionsResource.sync(row.userId);
      setToast({ message: `Dados de ${row.email} atualizados a partir do Stripe.`, tone: 'success' });
      state.reload(true);
    } catch (e) {
      setToast({ message: friendlyError(e), tone: 'error' });
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Assinaturas"
        subtitle="Todas as assinaturas do Stripe: situação, plano, valor e renovação"
        actions={
          <Button icon={RefreshCw} loading={Boolean(job?.running)} onClick={startSyncAll} title="Relê do Stripe a assinatura de todos os clientes">
            {job?.running ? `Sincronizando ${job.done}/${job.total}…` : 'Sincronizar todos'}
          </Button>
        }
      />

      {health.data && !health.data.ok && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200 space-y-2">
          <p className="flex items-center gap-2 font-semibold text-red-100"><TriangleAlert className="w-4 h-4" /> O webhook do Stripe não está configurado direito</p>
          <p>Sem ele, pagamentos, renovações e cancelamentos feitos no Stripe não chegam ao app.</p>
          <ul className="list-disc pl-5 space-y-1">{health.data.problems.map((p) => <li key={p} className="break-words">{p}</li>)}</ul>
          <p className="text-red-300">No Stripe (Developers → Webhooks), o endpoint deve ser <code className="rounded bg-red-950 px-1.5 py-0.5 text-red-100">{health.data.expectedUrl}</code> e o segredo dele precisa estar em STRIPE_WEBHOOK_SECRET na API.</p>
        </div>
      )}
      {health.data?.ok && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Webhook do Stripe configurado: {health.data.expectedUrl}</p>
      )}

      <AsyncView state={state}>
        {(data) => (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat label="Ativas" value={num(data.counts.active)} icon={CreditCard} tone="text-emerald-400" />
              <Stat label="Em teste (Stripe)" value={num(data.counts.trialing)} icon={Users} tone="text-sky-300" />
              <Stat label="Pagamento pendente" value={num(data.counts.past_due)} icon={TriangleAlert} tone="text-red-400" />
              <Stat label="Cancelando" value={num(data.counts.canceling)} hint="vão encerrar no fim do período" icon={CalendarClock} tone="text-amber-300" />
              <Stat label="Encerradas" value={num(data.counts.canceled)} icon={UserMinus} />
            </div>

            <Card padded={false}>
              <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
                {FILTERS.map((f) => (
                  <Button key={f.key} size="sm" variant={filter === f.key ? 'primary' : 'secondary'} onClick={() => setFilter(f.key)}>{f.label}</Button>
                ))}
                <input className={`${inputClass} max-w-xs ml-auto`} placeholder="Buscar e-mail ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {data.rows.length === 0 ? (
                <EmptyState title="Nenhuma assinatura aqui" description="Quando alguém assinar pelo Stripe, aparece nesta lista." />
              ) : (
                <TableWrap>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className={thClass}>Cliente</th>
                        <th className={thClass}>Situação</th>
                        <th className={thClass}>Plano</th>
                        <th className={thClass}>Próxima cobrança / fim do acesso</th>
                        <th className={thClass}>Cliente desde</th>
                        <th className={thClass} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {data.rows.map((r) => (
                        <tr key={r.userId}>
                          <td className={tdClass}>
                            <Link to={`/users/${r.userId}`} className="text-white hover:underline">{r.email}</Link>
                            {r.name && <div className="text-xs text-gray-500">{r.name}</div>}
                          </td>
                          <td className={tdClass}><StatusBadge row={r} /></td>
                          <td className={tdClass}>{planLabel(r)}</td>
                          <td className={tdClass}>
                            {r.renewsAt ? <>Renova em {date(r.renewsAt)}</> : r.endsAt ? <span className="text-amber-300">Acesso até {date(r.endsAt)}</span> : '—'}
                          </td>
                          <td className={tdClass}>{date(r.since)}</td>
                          <td className={`${tdClass} text-right whitespace-nowrap`}>
                            <Button size="sm" icon={RefreshCw} loading={syncing === r.userId} onClick={() => sync(r)} title="Reler do Stripe">Sincronizar</Button>
                            {r.stripeUrl && (
                              <a href={r.stripeUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs text-violet-300 hover:underline">
                                Stripe <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
          </>
        )}
      </AsyncView>
      <Toast message={toast.message} tone={toast.tone} onDone={() => setToast({ message: '', tone: 'success' })} />
    </div>
  );
}
